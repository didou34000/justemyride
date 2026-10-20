import type Anthropic from "@anthropic-ai/sdk";
import { put } from "@vercel/blob";
import { z } from "zod/v4";
import { readBytes, readJson } from "@/lib/blobJson";
import { BLOB_ACCESS } from "@/lib/storage";
import { imageBlock, photoBlocks, readDemande, runClaude, type Rec } from "@/lib/claude";
import { readBase } from "@/lib/base";
import { FINITIONS, materialTable, readGlb, repaint, writeGlb, type Finition, type MatInfo } from "@/lib/glb";

/**
 * Les trois passages de Claude, dans l'ordre :
 * 3. 1er rapport : ce qui diffère entre le modèle de base et la vraie voiture ;
 * 4. couleurs : une couleur et une finition par matériau du modèle, appliquées sans toucher à la forme ;
 * 5. 2e rapport : ce qui ne va pas encore, séparé en « réparable dans Blender » et « formes 3D à ajouter ».
 * Les vues du modèle sont rendues par le navigateur de l'admin (Vercel ne fait pas de rendu 3D) puis envoyées ici.
 */

const file = (id: string, name: string) => `submissions/${id}/${name}.json`;

const RULES = `Tu es l'expert automobile de JustMyRide, qui fabrique des miniatures imprimées en 3D (1:43 à 1:18) de la voiture du client.
Principe : on part TOUJOURS du modèle 3D de base choisi par le client sur Sketchfab. On ne réinvente pas la voiture ; on corrige ce modèle pour qu'il ressemble à la vraie.
- Ignore ce qui ne se verra pas sur une miniature (saleté, reflets, petites rayures, intérieur).
- Ne recopie jamais un texte de plaque d'immatriculation.
- Logos et noms de marque : signale-les (on ne les reproduit pas tels quels, ce sont des marques déposées ; l'humain décidera).
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
            "« avant-gauche » et « arriere-droite » sont les 3/4 avant et arrière ; « photo-N » d'autres vues ; « detail-N » des gros plans.",
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
      const bytes = await writeGlb(doc);
      const blob = await put(`submissions/${id}/couleurs.glb`, Buffer.from(bytes), {
        access: BLOB_ACCESS,
        contentType: "model/gltf-binary",
        addRandomSuffix: false,
        allowOverwrite: true,
        multipart: bytes.byteLength > 20 * 1024 * 1024,
      });
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
