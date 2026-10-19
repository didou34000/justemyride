import { get, put } from "@vercel/blob";
import { readJson, writeJson } from "@/lib/blobJson";
export { isAdmin } from "@/lib/adminAuth";
import { BLOB_ACCESS, storageEnabled } from "@/lib/storage";
import { MESHY_VIEWS } from "@/lib/steps";
import { readFichiers } from "@/lib/fichiers";

/**
 * Génération 3D Meshy (multi-photos → GLB), côté serveur uniquement.
 *
 * Garde-fous, pour que la facture ne s'emballe pas :
 * - rien n'est lancé automatiquement : seul le propriétaire déclenche, avec ADMIN_TOKEN ;
 * - plafond par jour et par mois (MESHY_DAILY_LIMIT, MESHY_MONTHLY_LIMIT), compté dans le stockage ;
 * - une seule génération par demande client ;
 * - si le stockage ou une variable manque, tout est refusé (jamais de génération « à l'aveugle »).
 * Le vrai plafond reste le solde du compte Meshy : ne pas activer la recharge automatique.
 */

/**
 * Deux générations par demande : la voiture (multi-vues, les 4 faces) et les logos
 * (une seule image des badges, préparée par Claude et déposée par le propriétaire).
 */
export type MeshyKind = "car" | "logos" | "split";
const KINDS: Record<MeshyKind, { api: string; file: string }> = {
  car: { api: "https://api.meshy.ai/openapi/v1/multi-image-to-3d", file: "meshy" },
  logos: { api: "https://api.meshy.ai/openapi/v1/image-to-3d", file: "meshy-logos" },
  // Découpe du modèle voiture en pièces séparées (Auto Split, 10 crédits), pour colorier chaque pièce exactement.
  split: { api: "https://api.meshy.ai/openapi/v1/print/split", file: "meshy-split" },
};
export const isMeshyKind = (k: unknown): k is MeshyKind => k === "car" || k === "logos" || k === "split";

/** Pièces demandées à la découpe « par couleur » (10 au maximum chez Meshy). */
const SPLIT_PROMPT =
  process.env.MESHY_SPLIT_PROMPT ||
  "body paint, roof and mirror caps, windows glass, headlights, front grille, wheel rims, tyres, tail lights, number plates, black plastic trim";
// Les 4 faces nourrissent le multi-vues (Meshy en accepte 4 au maximum).
const VIEWS = MESHY_VIEWS;

const num = (v: string | undefined, d: number) => (v && /^\d+$/.test(v) ? Number(v) : d);
export const DAILY_LIMIT = num(process.env.MESHY_DAILY_LIMIT, 2);
export const MONTHLY_LIMIT = num(process.env.MESHY_MONTHLY_LIMIT, 10);

export function meshyConfigured() {
  return Boolean(process.env.MESHY_API_KEY && process.env.ADMIN_TOKEN && storageEnabled());
}


type Usage = { days: Record<string, number>; total: number };
const usagePath = (d: Date) => `meshy/usage-${d.toISOString().slice(0, 7)}.json`;

export async function usage(now = new Date()) {
  const u = (await readJson<Usage>(usagePath(now))) ?? { days: {}, total: 0 };
  const today = u.days[now.toISOString().slice(0, 10)] ?? 0;
  return { today, month: u.total, dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT, raw: u };
}

export type Job = {
  status: "starting" | "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED" | "error";
  taskId?: string;
  progress?: number;
  glb?: string;
  /** Aperçu image du résultat, copié depuis Meshy. */
  thumb?: string;
  /** Ce qu'on a envoyé : les photos et les réglages. */
  inputs?: string[];
  texture?: boolean;
  error?: string;
  /** Découpe : nombre de pièces obtenues. */
  parts?: number;
  startedAt: string;
};

const jobPath = (id: string, kind: MeshyKind) => `submissions/${id}/${KINDS[kind].file}.json`;
export const readJob = (id: string, kind: MeshyKind = "car") => readJson<Job>(jobPath(id, kind));

async function meshy(kind: MeshyKind, path: string, init?: RequestInit) {
  const res = await fetch(`${KINDS[kind].api}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.MESHY_API_KEY}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || `Meshy a répondu ${res.status}`);
  return body;
}

/** Photo privée → data URI (Meshy ne peut pas lire le stockage privé). */
async function asDataUri(pathname: string) {
  const r = await get(pathname, { access: BLOB_ACCESS });
  if (!r || r.statusCode !== 200) throw new Error(`Photo introuvable : ${pathname}`);
  const buf = Buffer.from(await new Response(r.stream).arrayBuffer());
  const type = r.headers.get("content-type") || "image/jpeg";
  return `data:${type};base64,${buf.toString("base64")}`;
}

/** Lance une génération pour une demande client, si tous les garde-fous passent. */
export async function startJob(id: string, kind: MeshyKind = "car"): Promise<Job> {
  if (await readJob(id, kind)) throw new Error("Une génération existe déjà pour cette demande");

  const now = new Date();
  const u = await usage(now);
  if (u.today >= DAILY_LIMIT) throw new Error(`Plafond du jour atteint (${DAILY_LIMIT})`);
  if (u.month >= MONTHLY_LIMIT) throw new Error(`Plafond du mois atteint (${MONTHLY_LIMIT})`);

  let photos: string[] = [];
  let input: string | undefined;
  if (kind === "split") {
    const car = await readJob(id, "car");
    if (!car?.taskId || !car.glb) throw new Error("Il faut d'abord le modèle Meshy de la voiture");
    input = car.taskId;
  } else if (kind === "logos") {
    const logos = (await readFichiers(id)).logos;
    if (!logos) throw new Error("Dépose d'abord l'image des logos");
    photos = [logos];
  } else {
    const demande = await readJson<{ files: { slot: string; pathname: string }[] }>(`submissions/${id}/demande.json`);
    if (!demande) throw new Error("Demande introuvable");
    photos = VIEWS.map((v) => demande.files.find((f) => f.slot === v)?.pathname).filter(Boolean) as string[];
    if (photos.length < 2) throw new Error("Il faut au moins 2 des 4 faces (avant, gauche, arrière, droite)");
  }

  // Réservation avant l'appel : un double clic ne lance pas deux générations payantes.
  const texture = process.env.MESHY_TEXTURE === "1";
  const job: Job = { status: "starting", startedAt: now.toISOString(), inputs: photos, texture };
  await writeJson(jobPath(id, kind), job);

  try {
    const images = await Promise.all(photos.map(asDataUri));
    // La texture coûte des crédits en plus et on repeint nous-mêmes.
    const body =
      kind === "split"
        ? { input_task_id: input, mode: "by_color", prompt: SPLIT_PROMPT, layout: "assembled" }
        : kind === "logos"
          ? { image_url: images[0], should_texture: texture }
          : { image_urls: images, should_texture: texture };
    const { result } = await meshy(kind, "", { method: "POST", body: JSON.stringify(body) });
    job.status = "PENDING";
    job.taskId = result;
  } catch (e) {
    job.status = "error";
    job.error = (e as Error).message;
    await writeJson(jobPath(id, kind), job);
    throw e;
  }

  const day = now.toISOString().slice(0, 10);
  u.raw.days[day] = (u.raw.days[day] ?? 0) + 1;
  u.raw.total += 1;
  await writeJson(usagePath(now), u.raw);
  await writeJson(jobPath(id, kind), job);
  return job;
}

/** Met à jour l'état ; une fois prêt, copie le GLB dans le stockage (les liens Meshy expirent). */
export async function refreshJob(id: string, kind: MeshyKind = "car"): Promise<Job | null> {
  const job = await readJob(id, kind);
  const file = `submissions/${id}/${KINDS[kind].file}`;
  if (!job?.taskId || ["FAILED", "CANCELED", "error"].includes(job.status)) return job;
  if (job.glb && job.thumb) return job;

  const t = await meshy(kind, `/${job.taskId}`);
  // Aperçu image (aussi rattrapé pour les générations finies avant que l'on garde l'aperçu).
  if (!job.thumb && t.thumbnail_url) {
    const img = await fetch(t.thumbnail_url).catch(() => null);
    if (img?.ok) {
      const saved = await put(`${file}.png`, Buffer.from(await img.arrayBuffer()), {
        access: BLOB_ACCESS,
        contentType: img.headers.get("content-type") || "image/png",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      job.thumb = saved.pathname;
    }
  }
  if (job.glb) {
    await writeJson(jobPath(id, kind), job);
    return job;
  }
  job.status = t.status;
  job.progress = t.progress;
  if (typeof t.part_count === "number") job.parts = t.part_count;
  if (t.status === "FAILED") job.error = t.task_error?.message || "Échec Meshy";
  if (t.status === "SUCCEEDED" && t.model_urls?.glb) {
    const glb = await fetch(t.model_urls.glb);
    if (!glb.ok) throw new Error("Téléchargement du GLB impossible");
    const saved = await put(`${file}.glb`, Buffer.from(await glb.arrayBuffer()), {
      access: BLOB_ACCESS,
      contentType: "model/gltf-binary",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    job.glb = saved.pathname;
  }
  await writeJson(jobPath(id, kind), job);
  return job;
}
