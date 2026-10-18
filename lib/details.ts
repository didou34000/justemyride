import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { num, readJson, usageCounter, writeJson } from "@/lib/blobJson";
import { analyseConfigured, photoBlock } from "@/lib/analyse";

/**
 * Contrôle des détails : après Meshy, Claude compare des vues du modèle 3D aux photos du client
 * et liste les petits détails qui manquent (badges, logos, antennes, essuie-glaces…), sans en faire trop.
 * Les vues du modèle sont rendues dans le navigateur de l'admin (Vercel ne fait pas de rendu 3D) puis envoyées ici.
 */

const MODEL = process.env.ANALYSE_MODEL || "claude-sonnet-5-5";
const usage = usageCounter("details", num(process.env.ANALYSE_DAILY_LIMIT, 20), num(process.env.ANALYSE_MONTHLY_LIMIT, 200));

const Details = z.object({
  resume: z.string().describe("1 ou 2 phrases : le rendu Meshy est-il fidèle, qu'est-ce qui manque surtout."),
  manques: z
    .array(
      z.object({
        detail: z.string().describe("Le détail manquant, court (ex. badge « Cooper S » du hayon)."),
        ou: z.string().describe("Où il se trouve sur la voiture."),
        type: z.enum(["logo_marque", "badge_texte", "petite_piece", "forme", "autre"]).catch("autre"),
        importance: z.enum(["haute", "moyenne", "basse"]).catch("basse"),
        solution: z
          .enum(["sketchfab", "decalque", "a_modeliser", "ignorer"])
          .describe("sketchfab = pièce 3D existante à chercher ; decalque = impression à plat ; a_modeliser = à refaire ; ignorer = invisible à l'échelle.")
          .catch("a_modeliser"),
        recherche: z.string().describe("Mots-clés en anglais pour chercher la pièce sur Sketchfab (vide si inutile)."),
      })
    )
    .describe("8 éléments au maximum, les plus visibles d'abord."),
  alertes: z.array(z.string()).describe("Problèmes du rendu lui-même (forme fausse, trou, roue mal placée), ou vide."),
});
export type Details = z.infer<typeof Details>;

export type DetailsRecord = {
  status: "running" | "done" | "error";
  startedAt: string;
  model: string;
  result?: Details;
  error?: string;
};

const path = (id: string) => `submissions/${id}/details.json`;
export const readDetails = (id: string) => readJson<DetailsRecord>(path(id));
export const detailsConfigured = analyseConfigured;

const SYSTEM = `Tu es l'expert automobile de JustMyRide, qui fabrique des miniatures imprimées en 3D (1:43 à 1:18) de la voiture du client.
Meshy a généré un modèle 3D à partir des photos. On te montre des vues de ce modèle (gris, sans couleur : ignore les couleurs) et les photos du client.
Ta tâche : lister les petits détails visibles sur les photos qui manquent ou sont mal rendus sur le modèle (badges, monogrammes, antenne, essuie-glace, poignées, grilles, sorties d'échappement, feux…).

Règles :
- Sans abuser : 8 éléments au maximum, seulement ce qui se verra sur une miniature. Le plus visible d'abord.
- Le chromé n'est pas un détail : tout ce qui est chromé sera peint en gris clair mat. Ne le liste pas.
- Les grosses différences de forme ont déjà été traitées : ne les répète que si le rendu est vraiment faux (dans alertes).
- Logos et noms de marque (ex. ailes MINI, « Cooper S ») : type logo_marque. On ne les reproduit pas tels quels (marques déposées) : propose decalque en le signalant, l'humain décidera.
- Pour chaque pièce qu'on pourrait trouver toute faite, donne des mots-clés anglais pour Sketchfab.
Réponds en français.`;

async function viewBlock(dataUrl: string, i: number): Promise<Anthropic.ContentBlockParam[]> {
  const m = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
  if (!m) throw new Error("Vue du modèle illisible");
  return [
    { type: "text", text: `Vue ${i + 1} du modèle Meshy :` },
    { type: "image", source: { type: "base64", media_type: `image/${m[1]}` as "image/jpeg", data: m[2] } },
  ];
}

/** Lance le contrôle des détails à partir des vues du modèle (data URL jpeg) rendues par le navigateur. */
export async function checkDetails(id: string, views: string[]): Promise<DetailsRecord> {
  if (!detailsConfigured()) throw new Error("Contrôle désactivé (clé Claude manquante)");
  if (!views.length || views.length > 6) throw new Error("Il faut entre 1 et 6 vues du modèle");
  const existing = await readDetails(id);
  if (existing?.status === "running" && Date.now() - Date.parse(existing.startedAt) < 600_000) return existing;

  const demande = await readJson<{ car?: string; files: { slot: string; pathname: string }[] }>(`submissions/${id}/demande.json`);
  if (!demande) throw new Error("Demande introuvable");
  await usage.check();

  const record: DetailsRecord = { status: "running", startedAt: new Date().toISOString(), model: MODEL };
  await writeJson(path(id), record);
  await usage.add();

  try {
    // Les angles principaux et les gros plans suffisent : pas besoin des 8 photos.
    const keep = ["avant-gauche", "arriere-droite", "avant", "arriere"];
    const photos = demande.files.filter((f) => keep.includes(f.slot) || f.slot.startsWith("detail"));
    const blocks: Anthropic.ContentBlockParam[] = [];
    for (const f of photos.slice(0, 8)) blocks.push(...(await photoBlock(f.slot, f.pathname).catch(() => [])));
    if (!blocks.length) throw new Error("Aucune photo lisible");
    const viewBlocks = (await Promise.all(views.map(viewBlock))).flat();

    const msg = await new Anthropic().messages
      .stream({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        output_config: { effort: "medium", format: zodOutputFormat(Details) },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `Voiture : ${demande.car || "non précisée"}. Photos du client :` },
              ...blocks,
              ...viewBlocks,
              { type: "text", text: "Liste les petits détails qui manquent au modèle." },
            ],
          },
        ],
      })
      .finalMessage();
    if (msg.stop_reason === "refusal") throw new Error("Contrôle refusé par le modèle");
    const text = msg.content.find((b) => b.type === "text")?.text;
    const parsed = text ? Details.safeParse(JSON.parse(text)) : null;
    if (!parsed?.success) throw new Error(`Réponse illisible (${msg.stop_reason})`);
    record.status = "done";
    record.result = { ...parsed.data, manques: parsed.data.manques.slice(0, 8) };
  } catch (e) {
    record.status = "error";
    record.error = e instanceof Anthropic.APIError ? `API ${e.status} : ${e.message}` : (e as Error).message;
  }
  await writeJson(path(id), record);
  return record;
}
