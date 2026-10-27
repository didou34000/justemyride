import type Anthropic from "@anthropic-ai/sdk";
import { putFile } from "@/lib/store";
import sharp from "sharp";
import { z } from "zod/v4";
import { readBytes, readJson, writeJson } from "@/lib/blobJson";
import { CONTROLE, controleOk } from "@/lib/steps";
import { imageBlock, photoBlocks, readDemande, runClaude, type Rec } from "@/lib/claude";
import { readBase } from "@/lib/base";
import { compressGlb, FINITIONS, materialTable, readGlb, repaint, writeGlb, type Finition, type MatInfo } from "@/lib/glb";

/**
 * Les trois passages de Claude, dans l'ordre :
 * 3. 1er rapport : ce qui diffère entre le modèle de base et la vraie voiture ;
 * 4. couleurs : une couleur et une finition par matériau du modèle, appliquées sans toucher à la forme ;
 * 5. 2e rapport : ce qui ne va pas encore, séparé en « réparable dans Blender » et « formes 3D à ajouter » ;
 * (7. 3e rapport : ce qui manque à la V2 ; 9. contrôle final : score de ressemblance de la miniature terminée.)
 * Les vues du modèle sont rendues par le navigateur de l'admin (Vercel ne fait pas de rendu 3D) puis envoyées ici.
 */

const file = (id: string, name: string) => `submissions/${id}/${name}.json`;

const RULES = `Tu es l'expert automobile de JustMyRide, qui fabrique des miniatures imprimées en 3D (1:43 à 1:18) de la voiture du client.
Principe : on part TOUJOURS du modèle 3D de base choisi par le client sur Sketchfab. On ne réinvente pas la voiture ; on corrige ce modèle pour qu'il ressemble à la vraie.
- Ignore ce qui ne se verra pas sur une miniature (saleté, reflets, petites rayures, intérieur).
- Ne recopie jamais un texte de plaque d'immatriculation.
- Logos et noms de marque : signale-les. On ne les reproduit JAMAIS (marques déposées) : à chaque emplacement de logo de marque, on pose notre monogramme JM en 3D à la place.
- Les vues du modèle sont numérotées « Vue 1 à 4 » : l'avant n'est pas forcément la vue 1, déduis-le de l'image.
- Si tu n'es pas sûr, dis-le : un humain relit.
Réponds en français, concret et précis.`;

// ——— 3. Premier rapport ———

const CATEGORIES = [
  "hauteur_caisse",
  "jantes",
  "pneus",
  "logo_badge",
  "sticker_decor",
  "prise_air",
  "pare_chocs",
  "calandre",
  "capot",
  "aileron",
  "diffuseur",
  "echappement",
  "feux",
  "retroviseurs",
  "vitres",
  "bas_de_caisse",
  "toit",
  "couleur",
  "autre",
] as const;

export const Rapport1 = z.object({
  resume: z.string().describe("2 ou 3 phrases : ce qu'on voit et l'ampleur des écarts avec le modèle de base."),
  base_ok: z.boolean().describe("Le modèle de base est-il bien la même voiture (génération, carrosserie, nombre de portes) ?"),
  base_remarque: z.string().describe("Pourquoi, et quelle version précise on voit sur les photos (ex. Cooper S, JCW, GP)."),
  couleurs: z
    .array(
      z.object({
        zone: z.string().describe("Carrosserie, toit, rétroviseurs, jantes, étriers, bandes, plastiques, vitres…"),
        couleur: z.string().describe("Nom de la teinte (ex. rouge piment, noir brillant)."),
        hex: z.string().describe("Teinte estimée au format #rrggbb, corrigée des reflets et de la lumière."),
        finition: z.enum(Object.keys(FINITIONS) as [Finition, ...Finition[]]).catch("satine"),
      })
    )
    .describe("Toutes les zones de couleur visibles sur la vraie voiture."),
  differences: z.array(
    z.object({
      categorie: z.enum(CATEGORIES).catch("autre"),
      ou: z.string().describe("Où exactement sur la voiture."),
      description: z.string().describe("Ce qui change entre le modèle et la vraie voiture : forme, taille, matière, position. Chiffre si possible (ex. caisse 3 cm plus basse)."),
      photos: z.array(z.string()).describe("Les noms des photos où on le voit."),
      confiance: z.enum(["haute", "moyenne", "basse"]).catch("basse"),
      traitement: z
        .enum(["couleur", "decalque", "blender", "forme_3d", "a_verifier"])
        .describe("couleur = repeindre ; decalque = sticker/bande imprimé à plat ; blender = réglable sur le modèle (hauteur, déplacer, supprimer) ; forme_3d = pièce à ajouter ; a_verifier = pas sûr.")
        .catch("a_verifier"),
    })
  ),
  photos_a_demander: z.array(z.string()).describe("Photos en plus utiles (ex. aileron de profil, gros plan des jantes)."),
  alertes: z.array(z.string()).describe("Logos de marque, photos inutilisables, doutes importants."),
});
export type Rapport1 = z.infer<typeof Rapport1>;

const SYSTEM1 = `${RULES}

Ta tâche : comparer en détail les photos de la vraie voiture au modèle 3D de base (4 vues rendues avec ses couleurs d'origine).
Passe en revue systématiquement, zone par zone :
- hauteur de caisse : distance sol-carrosserie, espace entre pneu et passage de roue (voiture rabaissée ?) ;
- jantes (dessin, nombre de branches, taille, couleur) et pneus ;
- logos, badges, monogrammes présents sur la voiture et absents du modèle (ou l'inverse) ;
- stickers, bandes, décors, lettrages ;
- prises d'air, écopes, grilles, calandre ;
- pare-chocs, bas de caisse, aileron, diffuseur, échappement ;
- feux, rétroviseurs, vitres (teintées ?), toit ;
- toutes les couleurs, zone par zone, avec une teinte hex la plus juste possible.
Une ligne par différence. Ne liste pas ce qui est identique.`;

export async function rapport1(id: string, views: string[]) {
  const demande = await readDemande(id);
  if (!demande) throw new Error("Demande introuvable");
  const base = await readBase(id);
  if (base?.status !== "done") throw new Error("Le modèle de base n'est pas encore là");
  return runClaude(file(id, "rapport1"), {
    system: SYSTEM1,
    schema: Rapport1,
    content: async () => {
      const { blocks, unreadable, skipped } = await photoBlocks(demande.files, 20);
      return [
        {
          type: "text",
          text: [
            `Voiture indiquée par le client : ${demande.car || "non précisée"}.`,
            `Modèle 3D de base : ${base.label}${base.author ? ` (Sketchfab, par ${base.author})` : ""}.`,
            skipped ? `Le client a envoyé ${demande.files.length} photos ; tu vois les 20 premières.` : "",
            unreadable.length ? `Photos illisibles : ${unreadable.join(", ")}.` : "",
            "Les photos guidées : « avant » (face avant), « avant-gauche » (3/4 avant), « gauche » et « droite » (profils), « arriere-droite » (3/4 arrière), « arriere » (face arrière) ; « photo-N » sont des photos en plus (gros plans, jantes, modifs).",
          ]
            .filter(Boolean)
            .join("\n"),
        },
        ...views.flatMap((v, i) => imageBlock(v, `Vue ${i + 1} du modèle 3D de base :`)),
        ...blocks,
        { type: "text", text: "Fais le premier rapport des différences." },
      ];
    },
  });
}

// ——— 4. Couleurs ———

const Couleurs = z.object({
  resume: z.string().describe("1 ou 2 phrases : ce qui a été repeint."),
  materiaux: z.array(
    z.object({
      id: z.string().describe("Le repère du matériau (m0, m1…), exactement comme dans la liste."),
      zone: z.string().describe("Ce que ce matériau couvre sur la voiture."),
      action: z.enum(["garder", "peindre"]).catch("garder"),
      couleur: z.string().describe("#rrggbb si peindre, vide sinon."),
      finition: z.enum(Object.keys(FINITIONS) as [Finition, ...Finition[]]).catch("satine"),
    })
  ),
  limites: z
    .array(z.string())
    .describe("Zones qu'on ne peut pas colorier juste en changeant un matériau (ex. toit et carrosserie sur le même matériau, bande dessinée dans une texture)."),
});
export type Couleurs = z.infer<typeof Couleurs>;

const SYSTEM2 = `${RULES}

Ta tâche : refaire les couleurs du modèle de base pour qu'il ressemble le plus possible à la vraie voiture, SANS rien inventer en forme.
Tu ne peux faire qu'une chose : donner à chaque matériau existant du modèle une couleur unie et une finition, ou le garder tel quel.
- On te donne la liste des matériaux (repère, nom, nombre de triangles, couleur actuelle) et, pour les principaux, une image où le matériau est en ROUGE vif (le reste en gris), vu de l'avant et de l'arrière en 3/4. Sers-toi de ces images pour savoir ce que couvre chaque matériau.
- Garde les matériaux qui sont déjà justes, ceux qu'on ne voit pas (intérieur, dessous) et ceux dont la texture porte des détails utiles (feux dessinés, grilles) si leur couleur va déjà.
- Finitions : brillant, satine (peinture par défaut), mat, metallise, chrome, alu, plastique (plastiques noirs), caoutchouc (pneus), verre (vitres claires), verre_teinte (vitres teintées), feu (feux et clignotants).
- Si une zone de la vraie voiture n'a pas de matériau à elle (ex. toit noir mais même matériau que la carrosserie), ne force rien : mets-la dans limites.
Utilise les teintes du premier rapport, corrige-les si les photos montrent mieux.`;

export type CouleursRec = Rec<Couleurs> & { applied?: string[] };

/** sheets : pour les principaux matériaux, l'image « matériau en rouge » rendue par le navigateur. */
export async function couleurs(id: string, sheets: { id: string; image: string }[], loadBase: (glb: string) => Promise<Uint8Array>) {
  const demande = await readDemande(id);
  if (!demande) throw new Error("Demande introuvable");
  const base = await readBase(id);
  if (base?.status !== "done" || !base.glb) throw new Error("Le modèle de base n'est pas encore là");
  const r1 = await readJson<Rec<Rapport1>>(file(id, "rapport1"));
  const doc = await readGlb(await loadBase(base.glb));
  const table = materialTable(doc);
  if (!table.length) throw new Error("Ce modèle n'a aucun matériau à repeindre");
  const ids = new Set(table.map((m) => m.id));

  return runClaude(
    file(id, "couleurs"),
    {
      system: SYSTEM2,
      schema: Couleurs,
      content: async () => {
        const { blocks } = await photoBlocks(demande.files, 8);
        const sheetBlocks: Anthropic.ContentBlockParam[] = sheets
          .filter((s) => ids.has(s.id))
          .flatMap((s) => imageBlock(s.image, `Matériau ${s.id} (${table.find((m) => m.id === s.id)?.name}) en rouge :`));
        return [
          { type: "text", text: `Voiture : ${demande.car || base.label}. Matériaux du modèle :\n${tableText(table)}` },
          { type: "text", text: r1?.result ? `Couleurs relevées au premier rapport :\n${JSON.stringify(r1.result.couleurs)}` : "Pas de premier rapport." },
          ...sheetBlocks,
          ...blocks,
          { type: "text", text: "Donne la couleur de chaque matériau à repeindre." },
        ];
      },
    },
    async (res) => {
      // Seuls les matériaux qui existent sont touchés : la forme du modèle reste exactement la même.
      const paints = res.materiaux
        .filter((m) => m.action === "peindre" && ids.has(m.id))
        .map((m) => ({ id: m.id, couleur: m.couleur, finition: m.finition }));
      const applied = repaint(doc, paints);
      // readGlb a décompressé le modèle : on le recompresse pour ne pas stocker une copie 4 fois plus lourde.
      const bytes = await writeGlb(await compressGlb(doc));
      const blob = await putFile(`submissions/${id}/couleurs.glb`, bytes, "model/gltf-binary");
      return { glb: blob.pathname, applied } as Partial<CouleursRec>;
    }
  ) as Promise<CouleursRec>;
}

const tableText = (t: MatInfo[]) =>
  t.map((m) => `${m.id} « ${m.name} » : ${m.triangles} triangles, couleur ${m.color}${m.texture ? " + texture" : ""}${m.transparent ? ", transparent" : ""}`).join("\n");

// ——— 5. Second rapport ———

export const Rapport2 = z.object({
  resume: z.string().describe("2 ou 3 phrases : à quel point la voiture repeinte ressemble à la vraie, et ce qui manque surtout."),
  ressemblance: z.enum(["tres_proche", "proche", "moyenne", "loin"]).catch("moyenne"),
  deja_bon: z.array(z.string()).describe("Ce qui est déjà juste (court)."),
  blender: z
    .array(
      z.object({
        probleme: z.string(),
        ou: z.string(),
        correction: z.string().describe("Ce qu'il faut faire dans Blender sur le modèle existant (séparer une zone pour la peindre, baisser la caisse de 3 cm, supprimer un logo, teinter les vitres…)."),
        importance: z.enum(["haute", "moyenne", "basse"]).catch("moyenne"),
      })
    )
    .describe("Ce qui se répare sur le modèle tel qu'il est, sans nouvelle forme."),
  formes_3d: z
    .array(
      z.object({
        forme: z.string().describe("La pièce à ajouter ou remplacer (ex. aileron de toit JCW, jantes 5 branches 17 pouces, prise d'air de capot)."),
        ou: z.string(),
        description: z.string().describe("Forme, taille, détails, matière, couleur : assez précis pour la chercher ou la modéliser."),
        remplace: z.boolean().describe("true si elle remplace une pièce du modèle, false si elle s'ajoute."),
        source: z.enum(["sketchfab", "a_modeliser", "decalque_relief"]).catch("a_modeliser"),
        recherche: z.string().describe("Mots-clés en anglais pour la chercher sur Sketchfab (vide si inutile)."),
        importance: z.enum(["haute", "moyenne", "basse"]).catch("moyenne"),
      })
    )
    .describe("TOUTES les formes 3D qui manquent, même petites, tant qu'elles se verront sur la miniature."),
  alertes: z.array(z.string()),
});
export type Rapport2 = z.infer<typeof Rapport2>;

const SYSTEM3 = `${RULES}

Le modèle de base a été repeint (seulement les couleurs des matériaux, la forme n'a pas changé). On te montre 4 vues de ce modèle repeint et les photos de la vraie voiture.
Ta tâche : le second rapport. Compare encore, zone par zone, et dis tout ce qui ne va pas, en deux listes :
1. blender : ce qui se répare directement sur ce modèle dans Blender, sans nouvelle forme (couleur mal placée parce qu'une zone partage un matériau, hauteur de caisse, carrossage, vitres, logo à retirer, pièce à supprimer ou déplacer, échelle d'une pièce…) ;
2. formes_3d : chaque forme 3D qu'il faudra en plus (pièce qui n'existe pas sur le modèle ou dont la forme est différente) : jantes, aileron, diffuseur, sorties d'échappement, prises d'air, badges en relief, antenne, élargisseurs… Sois le plus complet possible : mieux vaut une ligne de trop qu'un oubli. Pour chacune, décris-la assez précisément pour la trouver ou la modéliser.
Ne mets pas une même chose dans les deux listes.`;

export async function rapport2(id: string, views: string[], glb: string) {
  const demande = await readDemande(id);
  if (!demande) throw new Error("Demande introuvable");
  const [r1, c] = await Promise.all([readJson<Rec<Rapport1>>(file(id, "rapport1")), readJson<CouleursRec>(file(id, "couleurs"))]);
  return runClaude(
    file(id, "rapport2"),
    {
      system: SYSTEM3,
      schema: Rapport2,
      maxTokens: 24000,
      content: async () => {
        const { blocks } = await photoBlocks(demande.files, 12);
        return [
          { type: "text", text: `Voiture : ${demande.car || "non précisée"}. Modèle repeint : ${glb.split("/").pop()}.` },
          r1?.result ? { type: "text", text: `Premier rapport (différences relevées) :\n${JSON.stringify(r1.result.differences)}` } : { type: "text", text: "Pas de premier rapport." },
          c?.result?.limites.length ? { type: "text", text: `Limites signalées pendant la mise en couleur :\n- ${c.result.limites.join("\n- ")}` } : { type: "text", text: "" },
          ...views.flatMap((v, i) => imageBlock(v, `Vue ${i + 1} du modèle repeint :`)),
          ...blocks,
          { type: "text", text: "Fais le second rapport." },
        ].filter((b) => b.type !== "text" || b.text) as Anthropic.ContentBlockParam[];
      },
    }
  );
}

// ——— 7. Troisième rapport : ce qui manque encore, et les pièces à demander à Meshy ———

/** Plafond strict : au maximum 4 pièces Meshy par commande. */
/** Nombre maximum de pièces listées pour Meshy (la 3D reste plafonnée à 4 générations par commande). */
export const MAX_PIECES = 10;

export const Rapport3 = z.object({
  resume: z.string().describe("2 phrases : la V2 ressemble-t-elle vraiment à la voiture, et qu'est-ce qui manque surtout."),
  manques: z.array(
    z.object({
      element: z.string().describe("Ce qui manque ou est faux (ex. jantes 5 branches doubles, badge S de calandre, pneus trop fins)."),
      ou: z.string(),
      importance: z
        .enum(["essentiel", "secondaire"])
        .describe("essentiel = sans ça, on ne reconnaît pas SA voiture ; secondaire = un petit détail (antenne, petit logo) ; les stickers visibles ne sont plus secondaires : on les refait.")
        .catch("secondaire"),
      solution: z
        .enum(["meshy", "blender", "decalque", "ignorer"])
        .describe("meshy = pièce 3D à générer d'après une photo ; blender = réglable sur le modèle ; decalque = impression à plat ; ignorer = pas la peine.")
        .catch("blender"),
    })
  ),
  meshy: z
    .array(
      z.object({
        type: z
          .enum(["piece", "sticker"])
          .describe("piece = élément en volume (roue, aileron, échappement…) ; sticker = décor plat collé sur la carrosserie (2 au maximum).")
          .catch("piece"),
        piece: z.string().describe("L'élément COMPLET à faire refaire par Meshy, un seul par ligne (ex. roue avant gauche complète : jante + pneu)."),
        photo: z.string().describe("Le nom exact de la photo du client où la pièce se voit le mieux, de 3/4 de préférence (ex. avant-gauche)."),
        cadre: z
          .object({ x: z.number(), y: z.number(), l: z.number(), h: z.number() })
          .describe("Le rectangle de la pièce dans cette photo, en fractions de 0 à 1 : x,y = coin haut gauche, l = largeur, h = hauteur. Serre la pièce, sans la couper."),
        consigne: z.string().describe("Ce que Meshy doit refaire exactement : forme, nombre de branches, détails. Pour une roue : jante ET pneu montés ensemble."),
      })
    )
    .describe(`Les pièces essentielles et les stickers (2 au maximum) à générer avec Meshy, ${MAX_PIECES} lignes au maximum, le plus important d'abord.`),
  logos: z
    .array(
      z.object({
        marque: z.string().describe("Le logo d'origine à remplacer (ex. hélice BMW du capot, écriture M140i du hayon)."),
        ou: z.string().describe("L'emplacement exact sur la voiture (ex. centre du capot juste au-dessus de la calandre)."),
        forme: z
          .enum(["rond", "ovale", "ecusson", "lettres", "autre"])
          .describe("La forme du logo d'origine : le monogramme JM prend la même place et à peu près la même taille.")
          .catch("autre"),
        taille: z.string().describe("Taille réelle estimée sur la voiture (ex. 8 cm de diamètre, 15 cm de large)."),
      })
    )
    .describe("TOUS les logos et noms de marque visibles sur les photos : chacun sera remplacé par le monogramme JM en 3D, au même endroit."),
});
export type Rapport3 = z.infer<typeof Rapport3>;
export type Rapport3Rec = Rec<Rapport3> & { crops?: (string | null)[] };

const SYSTEM4 = `${RULES}

On te montre 4 vues de la V2 de la miniature (le modèle de base repeint puis retouché dans Blender) et les photos de la vraie voiture.
Ta tâche : vérifier ce qui manque encore (logos, badges, jantes, pneus, aileron, échappement, prises d'air, feux…) et en faire la liste complète.
Le but : la miniature doit VRAIMENT ressembler à la voiture du client, sans être identique au millimètre. Classe chaque manque :
- essentiel : sans lui, le client ne reconnaît pas sa voiture (jantes différentes, aileron, kit carrosserie, badge très visible) ;
- secondaire : un petit détail (une antenne, un petit logo).
Les stickers et décors visibles (bandes, autocollants, numéros) ne sont PAS à laisser tomber : la miniature doit avoir à peu près tout.
Ensuite, liste (${MAX_PIECES} au maximum, la plus importante d'abord) les pièces essentielles à faire générer en 3D par Meshy, d'après UNE photo chacune :
- prends la photo où la pièce se voit le mieux, de 3/4 de préférence (Meshy reconstruit mieux en 3/4) ;
- donne le rectangle de la pièce dans cette photo : on recadre la photo dessus, car Meshy refait l'objet principal de l'image ;
- toujours l'élément COMPLET : une roue = la jante ET son pneu (jamais la jante seule) ; un aileron avec ses pieds ; etc. ;
- une pièce par ligne ; pour des roues identiques, une seule roue suffit (on la copiera sur les 4).
Ajoute aussi à la liste meshy les stickers visibles, 2 au maximum (les plus grands ou les plus reconnaissables d'abord), avec type « sticker » :
le cadre serre le sticker seul, la consigne décrit son dessin, ses couleurs et où il se pose. Les autres stickers : solution « decalque ».
Si rien d'essentiel ne manque et qu'il n'y a pas de sticker, laisse la liste meshy vide.
Logos : relève dans « logos » CHAQUE logo ou nom de marque visible (calandre, capot, hayon, jantes, ailes…), avec son emplacement exact, sa forme et sa taille.
Ne les mets ni dans la liste meshy ni en décalque : on ne reproduit jamais un vrai logo, on pose à la place notre monogramme JM en 3D (pièce déjà prête, 0 crédit).`;

/** Recadre la photo sur la pièce (avec une marge) pour que Meshy ne refasse pas toute la voiture. */
async function crop(id: string, i: number, pathname: string, c: { x: number; y: number; l: number; h: number }) {
  const img = sharp((await readBytes(pathname)).data).rotate();
  const buf = await img.toBuffer({ resolveWithObject: true });
  const W = buf.info.width;
  const H = buf.info.height;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const pad = 0.15;
  const x0 = clamp(c.x - c.l * pad);
  const y0 = clamp(c.y - c.h * pad);
  const x1 = clamp(c.x + c.l * (1 + pad));
  const y1 = clamp(c.y + c.h * (1 + pad));
  const left = Math.round(x0 * W);
  const top = Math.round(y0 * H);
  const width = Math.max(16, Math.round((x1 - x0) * W));
  const height = Math.max(16, Math.round((y1 - y0) * H));
  const out = await sharp(buf.data)
    .extract({ left, top, width: Math.min(width, W - left), height: Math.min(height, H - top) })
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  const blob = await putFile(`submissions/${id}/piece-${i + 1}.jpg`, out, "image/jpeg");
  return blob.pathname;
}

export async function rapport3(id: string, views: string[], glb: string) {
  const demande = await readDemande(id);
  if (!demande) throw new Error("Demande introuvable");
  const r2 = await readJson<Rec<Rapport2>>(file(id, "rapport2"));
  return runClaude(
    file(id, "rapport3"),
    {
      system: SYSTEM4,
      schema: Rapport3,
      maxTokens: 16000,
      content: async () => {
        const { blocks } = await photoBlocks(demande.files, 16);
        return [
          { type: "text", text: `Voiture : ${demande.car || "non précisée"}. V2 : ${glb.split("/").pop()}.` },
          r2?.result
            ? { type: "text", text: `Second rapport (avant la V2) :\n${JSON.stringify({ blender: r2.result.blender, formes_3d: r2.result.formes_3d })}` }
            : { type: "text", text: "Pas de second rapport." },
          ...views.flatMap((v, i) => imageBlock(v, `Vue ${i + 1} de la V2 :`)),
          ...blocks,
          { type: "text", text: "Fais la liste de ce qui manque et choisis les pièces pour Meshy." },
        ] as Anthropic.ContentBlockParam[];
      },
    },
    async (res) => {
      // Au plus 2 stickers (leur propre plafond chez Meshy), et MAX_PIECES lignes en tout.
      let stickers = 0;
      res.meshy = res.meshy.filter((m) => m.type !== "sticker" || ++stickers <= 2).slice(0, MAX_PIECES);
      // Un recadrage raté ne bloque pas le rapport : la pièce reste listée, sans image à envoyer.
      const crops = await Promise.all(
        res.meshy.map((m, i) => {
          const f = demande.files.find((x) => x.slot === m.photo);
          return f ? crop(id, i, f.pathname, m.cadre).catch(() => null) : Promise.resolve(null);
        })
      );
      return { crops } as Partial<Rapport3Rec>;
    }
  ) as Promise<Rapport3Rec>;
}

/** Lit un .glb de la commande dans le stockage, ou un fichier public du site (voiture du garage). */
export function glbLoader(origin: string, cookie: string | null) {
  return async (glb: string) => {
    if (!glb.startsWith("/")) return new Uint8Array((await readBytes(glb)).data);
    // Le cookie de l'admin passe la protection des aperçus Vercel.
    const res = await fetch(new URL(glb, origin), { headers: cookie ? { cookie } : {} });
    if (!res.ok) throw new Error(`Modèle du garage illisible (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  };
}

// ——— 9. Contrôle final : la miniature terminée ressemble-t-elle assez à la voiture ? ———

export const Controle = z.object({
  score: z.number().describe("Ressemblance globale de la miniature avec la vraie voiture, de 0 à 100 (barème dans les consignes)."),
  resume: z.string().describe("2 phrases : le client reconnaîtra-t-il sa voiture, et qu'est-ce qui coince surtout."),
  points_ok: z.array(z.string()).describe("Ce qui est bien réussi (court)."),
  ecarts: z.array(
    z.object({
      element: z.string().describe("Ce qui ne va pas (ex. jantes trop fines, aileron absent, rouge trop clair)."),
      ou: z.string(),
      gravite: z
        .enum(["bloquant", "a_corriger", "detail"])
        .describe("bloquant = le client ne reconnaît pas sa voiture à cause de ça ; a_corriger = ça se voit ; detail = on peut laisser.")
        .catch("a_corriger"),
      correction: z
        .enum(["blender", "couleur", "meshy", "decalque"])
        .describe("blender = retouche du modèle ; couleur = repeindre ; meshy = pièce 3D à refaire (seulement s'il en reste) ; decalque = impression à plat.")
        .catch("blender"),
      consigne: z.string().describe("Ce qu'il faut faire précisément pour corriger, utilisable tel quel dans Blender."),
    })
  ),
});
export type Controle = z.infer<typeof Controle>;
export type ControleRec = Rec<Controle>;
/** Un essai du contrôle (gardé à part : le passage en cours réécrit controle.json). */
export type ControleEssai = { at: string; glb: string; score: number; valide: boolean; resume: string };

const SYSTEM9 = `${RULES}

On te montre 4 vues de la miniature TERMINÉE (modèle repeint, retouché dans Blender, pièces Meshy posées) et les photos de la vraie voiture.
C'est le contrôle avant d'envoyer le rendu au client. Donne un score de ressemblance de 0 à 100, honnête et sévère, avec ce barème :
- silhouette et proportions (hauteur de caisse, carrosserie, volumes) : 30 points ;
- couleurs et finitions de chaque zone : 20 points ;
- roues (jantes, pneus, taille, position) : 20 points ;
- éléments distinctifs (aileron, kit, prises d'air, échappement, feux, badges visibles) : 20 points ;
- détails (rétros, bandes, petits éléments) : 10 points.
Plus de ${CONTROLE.seuil} seulement si le client reconnaît SA voiture au premier coup d'œil, qu'il ne reste rien de bloquant et qu'à peu près TOUT y est,
petits détails compris : les stickers visibles (2 sont refaits en 3D, les autres en décalque) doivent être présents et au bon endroit. Un sticker ou un détail visible absent fait perdre des points. Ne gonfle pas le score : un humain s'en sert pour décider d'envoyer ou non.
Si le score ne dépasse pas ${CONTROLE.seuil}, liste TOUS les écarts, du plus grave au moins grave, chacun avec une consigne de correction précise.
Logos : la miniature ne porte JAMAIS le vrai logo de la marque. À chaque emplacement de logo, on attend notre monogramme JM en 3D, à la même place et à peu près à la même taille.
- un monogramme JM à la place du logo compte comme juste : ne retire aucun point parce que le vrai logo n'y est pas ;
- un emplacement de logo resté vide fait perdre des points (écart a_corriger, correction blender : poser le monogramme JM) ;
- un vrai logo de marque visible sur la miniature est un écart bloquant (correction blender : le retirer et poser le monogramme JM).
Si un contrôle précédent t'est donné, vérifie d'abord si ses écarts ont été corrigés, et reste cohérent dans ta notation.`;

const essaisPath = (id: string) => file(id, "controle-essais");
export const readEssais = async (id: string) => (await readJson<ControleEssai[]>(essaisPath(id))) ?? [];

export async function controle(id: string, views: string[], glb: string, meshyRestant: { pieces: number; stickers: number }) {
  const demande = await readDemande(id);
  if (!demande) throw new Error("Demande introuvable");
  const essais = await readEssais(id);
  const prev = await readJson<ControleRec>(file(id, "controle"));
  const logos = (await readJson<Rapport3Rec>(file(id, "rapport3")))?.result?.logos ?? [];
  return runClaude(
    file(id, "controle"),
    {
      system: SYSTEM9,
      schema: Controle,
      maxTokens: 16000,
      content: async () => {
        const { blocks } = await photoBlocks(demande.files, 16);
        return [
          {
            type: "text",
            text:
              `Voiture : ${demande.car || "non précisée"}. Essai n° ${essais.length + 1}. ` +
              `Générations Meshy encore possibles : ${meshyRestant.pieces} pièce(s), ${meshyRestant.stickers} sticker(s). ` +
              `Ne propose une correction meshy que s'il en reste pour cette sorte d'élément ; sinon blender ou decalque.`,
          },
          prev?.result
            ? { type: "text", text: `Contrôle précédent (${prev.result.score} %) :\n${JSON.stringify(prev.result.ecarts)}` }
            : { type: "text", text: "Premier contrôle." },
          {
            type: "text",
            text: logos.length
              ? `Emplacements de logos relevés (monogramme JM attendu à chacun) :\n${logos.map((l) => `- ${l.marque} : ${l.ou} (${l.taille})`).join("\n")}`
              : "Aucun emplacement de logo relevé : vérifie quand même qu'aucun vrai logo de marque n'est visible.",
          },
          ...views.flatMap((v, i) => imageBlock(v, `Vue ${i + 1} de la miniature terminée :`)),
          ...blocks,
          { type: "text", text: "Donne le score de ressemblance et la liste des écarts." },
        ] as Anthropic.ContentBlockParam[];
      },
    },
    async (res) => {
      res.score = Math.max(0, Math.min(100, Math.round(res.score)));
      await writeJson(essaisPath(id), [
        ...essais,
        { at: new Date().toISOString(), glb, score: res.score, valide: controleOk(res.score), resume: res.resume },
      ]);
      return { glb } as Partial<ControleRec>;
    }
  ) as Promise<ControleRec>;
}
