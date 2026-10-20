import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import sharp from "sharp";
import type { z } from "zod/v4";
import { num, readBytes, readJson, usageCounter, writeJson } from "@/lib/blobJson";
import { storageEnabled } from "@/lib/storage";

/**
 * Ce qui est commun aux trois passages de Claude sur une commande (1er rapport, couleurs, 2e rapport) :
 * le modèle, le plafond de dépenses, les photos et l'appel avec réponse structurée.
 */

// Sonnet : bon en vision et 2 fois moins cher qu'Opus. ANALYSE_MODEL permet d'en changer sans toucher au code.
export const MODEL = process.env.ANALYSE_MODEL || "claude-sonnet-5-5";

// Un seul compteur pour tous les appels : 3 par commande (quelques centimes chacun).
const usage = usageCounter("analyse", num(process.env.ANALYSE_DAILY_LIMIT, 40), num(process.env.ANALYSE_MONTHLY_LIMIT, 400));
export const claudeUsage = () => usage.read();

export const claudeConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY && storageEnabled());

/** Un passage de Claude enregistré dans la commande (submissions/<id>/<nom>.json). */
export type Rec<T> = {
  status: "running" | "done" | "error";
  startedAt: string;
  model: string;
  result?: T;
  error?: string;
  usage?: { input: number; output: number };
  /** Fichier produit par ce passage (le .glb repeint pour les couleurs). */
  glb?: string;
};

/** Au-delà de 10 minutes, un passage « en cours » a été coupé (délai du serveur dépassé). */
export const stale = (r: { status: string; startedAt: string } | null) =>
  Boolean(r && r.status === "running" && Date.now() - Date.parse(r.startedAt) > 600_000);

export type Demande = {
  id: string;
  email: string;
  car: string;
  base?: { label: string; uid?: string; car?: string; years?: string; source: string } | null;
  files: { slot: string; pathname: string }[];
};

export const readDemande = (id: string) => readJson<Demande>(`submissions/${id}/demande.json`);

/** Photo du client → JPEG réduit (les photos de téléphone dépassent la taille acceptée par l'API). */
export async function photoBlock(slot: string, pathname: string): Promise<Anthropic.ContentBlockParam[]> {
  const { data } = await readBytes(pathname);
  const jpeg = await sharp(data).rotate().resize(1568, 1568, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  return [
    { type: "text", text: `Photo du client « ${slot} » :` },
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } },
  ];
}

/** Les photos du client (max premières), en sautant celles qu'on ne sait pas lire. */
export async function photoBlocks(files: Demande["files"], max: number) {
  const blocks: Anthropic.ContentBlockParam[] = [];
  const unreadable: string[] = [];
  for (const f of files.slice(0, max)) {
    try {
      blocks.push(...(await photoBlock(f.slot, f.pathname)));
    } catch {
      unreadable.push(f.slot);
    }
  }
  if (!blocks.length) throw new Error("Aucune photo lisible");
  return { blocks, unreadable, skipped: Math.max(0, files.length - max) };
}

/** Image rendue par le navigateur de l'admin (data URL) → bloc pour Claude. */
export function imageBlock(dataUrl: string, label: string): Anthropic.ContentBlockParam[] {
  const m = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
  if (!m) throw new Error("Image rendue illisible");
  return [
    { type: "text", text: label },
    { type: "image", source: { type: "base64", media_type: `image/${m[1]}` as "image/jpeg", data: m[2] } },
  ];
}

/** Rendus du navigateur : on refuse ce qui n'est pas une petite image (data URL). */
export const validImages = (v: unknown, max: number): v is string[] =>
  Array.isArray(v) && v.length > 0 && v.length <= max && v.every((x) => typeof x === "string" && x.startsWith("data:image/") && x.length < 1_500_000);

/**
 * Lance un passage de Claude et l'enregistre (running → done/error) dans submissions/<id>/<name>.json.
 * Ne lève pas d'erreur une fois lancé : l'état est enregistré. Lève avant si un plafond est atteint.
 */
export async function runClaude<S extends z.ZodType>(
  path: string,
  opts: { system: string; content: () => Promise<Anthropic.ContentBlockParam[]>; schema: S; maxTokens?: number },
  after?: (result: z.infer<S>) => Promise<Partial<Rec<z.infer<S>>> | void>
): Promise<Rec<z.infer<S>>> {
  if (!claudeConfigured()) throw new Error("Claude désactivé (ANTHROPIC_API_KEY ou stockage manquant)");
  const existing = await readJson<Rec<z.infer<S>>>(path);
  if (existing?.status === "running" && !stale(existing)) return existing;
  await usage.check();

  const record: Rec<z.infer<S>> = { status: "running", startedAt: new Date().toISOString(), model: MODEL };
  await writeJson(path, record);
  await usage.add();
  try {
    const msg = await new Anthropic().messages
      .stream({
        model: MODEL,
        max_tokens: opts.maxTokens ?? 16000,
        system: opts.system,
        output_config: { effort: "medium", format: zodOutputFormat(opts.schema) },
        messages: [{ role: "user", content: await opts.content() }],
      })
      .finalMessage();
    if (msg.stop_reason === "refusal") throw new Error("Demande refusée par le modèle");
    const text = msg.content.find((b) => b.type === "text")?.text;
    const parsed = text ? opts.schema.safeParse(JSON.parse(text)) : null;
    if (!parsed?.success) throw new Error(`Réponse illisible (${msg.stop_reason})`);
    record.result = parsed.data;
    record.usage = { input: msg.usage.input_tokens, output: msg.usage.output_tokens };
    Object.assign(record, (await after?.(parsed.data)) ?? {});
    record.status = "done";
  } catch (e) {
    record.status = "error";
    record.error = e instanceof Anthropic.APIError ? `API ${e.status} : ${e.message}` : (e as Error).message;
  }
  await writeJson(path, record);
  return record;
}
