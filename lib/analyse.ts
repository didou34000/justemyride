import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import sharp from "sharp";
import { z } from "zod/v4";
import { num, readBytes, readJson, usageCounter, writeJson } from "@/lib/blobJson";
import { storageEnabled } from "@/lib/storage";
import { model as sketchfabModel } from "@/lib/sketchfab";
import { cars } from "@/lib/cars";
import type { Base } from "@/lib/catalog";

/**
 * Analyse automatique d'une demande : Claude regarde toutes les photos du client
 * et liste ce qui diffère de la voiture de base choisie (pièces, couleurs, décors).
 *
 * Garde-fous : clé ANTHROPIC_API_KEY obligatoire, une analyse par demande,
 * plafonds ANALYSE_DAILY_LIMIT / ANALYSE_MONTHLY_LIMIT (quelques centimes chacune).
 */

const MODEL = "claude-opus-5-5";
const usage = usageCounter(
  "analyse",
  num(process.env.ANALYSE_DAILY_LIMIT, 20),
  num(process.env.ANALYSE_MONTHLY_LIMIT, 200)
);

export const analyseConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY && storageEnabled());

const PARTS = [
  "pare-chocs avant",
  "calandre",
  "capot",
  "phares",
  "rétroviseurs",
  "bas de caisse",
  "jantes",
  "étriers",
  "hauteur de caisse",
  "aileron",
  "pare-chocs arrière",
  "diffuseur",
  "échappement",
  "feux arrière",
  "toit",
  "vitres",
  "couleur",
  "décor",
  "autre",
] as const;

const Analysis = z.object({
  resume: z.string().describe("2 ou 3 phrases : ce qu'on voit et l'ampleur des changements."),
  base_ok: z.boolean().describe("La voiture des photos correspond-elle au modèle de base (génération, carrosserie) ?"),
  base_remarque: z.string().describe("Pourquoi, et quelle version précise (ex. Cooper S, JCW, GP)."),
  couleurs: z.object({
    carrosserie: z.string(),
    toit: z.string(),
    jantes: z.string(),
    autres: z.string().describe("Rétroviseurs, bandes, étriers… ou vide."),
  }),
  differences: z.array(
    z.object({
      piece: z.enum(PARTS).catch("autre"),
      description: z.string().describe("Ce qui change par rapport à la base, concrètement (forme, taille, matière)."),
      photos: z.array(z.string()).describe("Les noms des photos où on le voit (ex. arriere, detail-2)."),
      confiance: z.enum(["haute", "moyenne", "basse"]).catch("basse"),
      traitement: z
        .enum(["couleur", "decalque", "piece_3d", "a_verifier"])
        .describe("couleur = juste repeindre ; decalque = sticker/flamme/bande ; piece_3d = forme différente à modéliser ; a_verifier = pas sûr.")
        // Une valeur hors liste ne fait pas échouer l'analyse : elle part en « à vérifier ».
        .catch("a_verifier"),
    })
  ),
  photos_a_demander: z.array(z.string()).describe("Photos supplémentaires utiles au client (ex. aileron de profil, en gros plan)."),
  alertes: z.array(z.string()).describe("Logos de marque, plaques, photos inutilisables, doutes importants."),
});
export type Analysis = z.infer<typeof Analysis>;

export type AnalysisRecord = {
  status: "running" | "done" | "error";
  startedAt: string;
  model: string;
  result?: Analysis;
  error?: string;
  usage?: { input: number; output: number };
};

type Demande = {
  id: string;
  email: string;
  car: string;
  base?: Base | null;
  files: { slot: string; pathname: string }[];
};

const recordPath = (id: string) => `submissions/${id}/analyse.json`;
export const readAnalysis = (id: string) => readJson<AnalysisRecord>(recordPath(id));

const SYSTEM = `Tu es l'expert automobile de JustMyRide, qui fabrique des miniatures imprimées en 3D de la voiture du client.
On part toujours d'un modèle 3D de base (la voiture d'origine du catalogue), puis on ajoute ce qui diffère.
Ton travail : comparer les photos du client à la version d'origine de ce modèle, et lister chaque différence visible qui compte pour une miniature au 1:43 – 1:18.

Règles :
- Compare à la voiture de série de cette génération (tu connais son apparence ; les images de référence du modèle 3D t'aident).
- Une ligne par pièce. Sois concret : forme, taille, matière, couleur.
- Ignore ce qui ne se verra pas sur une miniature (saleté, reflets, petites rayures, intérieur).
- Ne recopie jamais un texte de plaque d'immatriculation. Signale les logos de marque dans les alertes (on ne les reproduit pas).
- Si une photo ne permet pas de juger, dis-le dans les alertes et propose la photo à demander.
- Si tu n'es pas sûr, mets confiance basse et traitement a_verifier : un humain relit ton point.
Réponds en français.`;

/** Photo du client → JPEG réduit (les photos de téléphone dépassent la taille acceptée par l'API). */
async function photoBlock(slot: string, pathname: string): Promise<Anthropic.ContentBlockParam[]> {
  const { data } = await readBytes(pathname);
  const jpeg = await sharp(data).rotate().resize(1568, 1568, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  return [
    { type: "text", text: `Photo « ${slot} » :` },
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } },
  ];
}

/** Images de référence du modèle de base (vignette Sketchfab ou photo du garage). */
async function referenceBlocks(base: Base | null | undefined): Promise<Anthropic.ContentBlockParam[]> {
  let url: string | undefined;
  if (base?.uid) url = (await sketchfabModel(base.uid).catch(() => null))?.thumb;
  else if (base?.car) {
    const car = cars.find((c) => c.slug === base.car);
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (car?.thumb && host) url = `https://${host}${car.thumb}`;
  }
  if (!url) return [];
  return [
    { type: "text", text: "Image de référence du modèle 3D de base (version d'origine) :" },
    { type: "image", source: { type: "url", url } },
  ];
}

/** Lance l'analyse d'une demande (une seule fois, sauf force). Ne lève pas d'erreur : l'état est enregistré. */
export async function analyse(id: string, { force = false } = {}): Promise<AnalysisRecord> {
  if (!analyseConfigured()) throw new Error("Analyse désactivée (ANTHROPIC_API_KEY ou stockage manquant)");
  const existing = await readAnalysis(id);
  if (existing && !force && existing.status !== "error") return existing;

  const demande = await readJson<Demande>(`submissions/${id}/demande.json`);
  if (!demande) throw new Error("Demande introuvable");
  await usage.check();

  const record: AnalysisRecord = { status: "running", startedAt: new Date().toISOString(), model: MODEL };
  await writeJson(recordPath(id), record);
  await usage.add();

  try {
    const photos: Anthropic.ContentBlockParam[] = [];
    const unreadable: string[] = [];
    for (const f of demande.files) {
      try {
        photos.push(...(await photoBlock(f.slot, f.pathname)));
      } catch {
        unreadable.push(f.slot);
      }
    }
    if (!photos.length) throw new Error("Aucune photo lisible");

    const base = demande.base;
    const intro = [
      `Voiture indiquée par le client : ${demande.car || "non précisée"}.`,
      base
        ? `Modèle 3D de base choisi : ${base.label}${base.years ? ` (${base.years})` : ""}${
            base.source === "aucune" ? " — aucun modèle 3D trouvé, compare à la version de série de cette voiture" : ""
          }.`
        : "Aucun modèle de base choisi : compare à la version de série de cette voiture.",
      unreadable.length ? `Photos illisibles (format non pris en charge) : ${unreadable.join(", ")}.` : "",
      "Les photos « avant », « gauche »… sont les 8 angles ; « detail-N » sont des gros plans ajoutés par le client.",
    ]
      .filter(Boolean)
      .join("\n");

    const client = new Anthropic();
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "high", format: zodOutputFormat(Analysis) },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: intro },
            ...(await referenceBlocks(base)),
            ...photos,
            { type: "text", text: "Fais le point des différences avec la voiture de base." },
          ],
        },
      ],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new Error("Analyse refusée par le modèle");
    const text = msg.content.find((b) => b.type === "text")?.text;
    const parsed = text ? Analysis.safeParse(JSON.parse(text)) : null;
    if (!parsed?.success) throw new Error(`Réponse illisible (${msg.stop_reason})`);

    record.status = "done";
    record.result = parsed.data;
    record.usage = { input: msg.usage.input_tokens, output: msg.usage.output_tokens };
  } catch (e) {
    record.status = "error";
    record.error = e instanceof Anthropic.APIError ? `API ${e.status} : ${e.message}` : (e as Error).message;
  }
  await writeJson(recordPath(id), record);
  return record;
}

export const analyseUsage = () => usage.read();
