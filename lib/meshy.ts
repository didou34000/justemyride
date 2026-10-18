import { get, put } from "@vercel/blob";
import { readJson, writeJson } from "@/lib/blobJson";
import { BLOB_ACCESS, storageEnabled } from "@/lib/storage";

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

const API = "https://api.meshy.ai/openapi/v1/multi-image-to-3d";
// Les 4 faces nourrissent le multi-vues (Meshy en accepte 4 au maximum).
const VIEWS = ["avant", "gauche", "arriere", "droite"];

const num = (v: string | undefined, d: number) => (v && /^\d+$/.test(v) ? Number(v) : d);
export const DAILY_LIMIT = num(process.env.MESHY_DAILY_LIMIT, 2);
export const MONTHLY_LIMIT = num(process.env.MESHY_MONTHLY_LIMIT, 10);

export function meshyConfigured() {
  return Boolean(process.env.MESHY_API_KEY && process.env.ADMIN_TOKEN && storageEnabled());
}

export function isAdmin(request: Request) {
  const expected = process.env.ADMIN_TOKEN;
  const given = request.headers.get("x-admin-token") ?? "";
  if (!expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
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
  error?: string;
  startedAt: string;
};

const jobPath = (id: string) => `submissions/${id}/meshy.json`;
export const readJob = (id: string) => readJson<Job>(jobPath(id));

async function meshy(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
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
export async function startJob(id: string): Promise<Job> {
  if (await readJob(id)) throw new Error("Une génération existe déjà pour cette demande");

  const now = new Date();
  const u = await usage(now);
  if (u.today >= DAILY_LIMIT) throw new Error(`Plafond du jour atteint (${DAILY_LIMIT})`);
  if (u.month >= MONTHLY_LIMIT) throw new Error(`Plafond du mois atteint (${MONTHLY_LIMIT})`);

  const demande = await readJson<{ files: { slot: string; pathname: string }[] }>(`submissions/${id}/demande.json`);
  if (!demande) throw new Error("Demande introuvable");
  const photos = VIEWS.map((v) => demande.files.find((f) => f.slot === v)?.pathname).filter(Boolean) as string[];
  if (photos.length < 2) throw new Error("Il faut au moins 2 des 4 faces (avant, gauche, arrière, droite)");

  // Réservation avant l'appel : un double clic ne lance pas deux générations payantes.
  const job: Job = { status: "starting", startedAt: now.toISOString() };
  await writeJson(jobPath(id), job);

  try {
    const { result } = await meshy("", {
      method: "POST",
      body: JSON.stringify({
        image_urls: await Promise.all(photos.map(asDataUri)),
        // La texture coûte des crédits en plus et on repeint la voiture nous-mêmes.
        should_texture: process.env.MESHY_TEXTURE === "1",
      }),
    });
    job.status = "PENDING";
    job.taskId = result;
  } catch (e) {
    job.status = "error";
    job.error = (e as Error).message;
    await writeJson(jobPath(id), job);
    throw e;
  }

  const day = now.toISOString().slice(0, 10);
  u.raw.days[day] = (u.raw.days[day] ?? 0) + 1;
  u.raw.total += 1;
  await writeJson(usagePath(now), u.raw);
  await writeJson(jobPath(id), job);
  return job;
}

/** Met à jour l'état ; une fois prêt, copie le GLB dans le stockage (les liens Meshy expirent). */
export async function refreshJob(id: string): Promise<Job | null> {
  const job = await readJob(id);
  if (!job?.taskId || job.glb || ["FAILED", "CANCELED", "error"].includes(job.status)) return job;

  const t = await meshy(`/${job.taskId}`);
  job.status = t.status;
  job.progress = t.progress;
  if (t.status === "FAILED") job.error = t.task_error?.message || "Échec Meshy";
  if (t.status === "SUCCEEDED" && t.model_urls?.glb) {
    const glb = await fetch(t.model_urls.glb);
    if (!glb.ok) throw new Error("Téléchargement du GLB impossible");
    const saved = await put(`submissions/${id}/meshy.glb`, Buffer.from(await glb.arrayBuffer()), {
      access: BLOB_ACCESS,
      contentType: "model/gltf-binary",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    job.glb = saved.pathname;
  }
  await writeJson(jobPath(id), job);
  return job;
}
