import { put } from "@vercel/blob";
import { num, readBytes, readJson, usageCounter, writeJson } from "@/lib/blobJson";
import { BLOB_ACCESS, storageEnabled } from "@/lib/storage";
import { MAX_PIECES, type Rapport3Rec } from "@/lib/rapports";

/**
 * Étape 8 : Meshy refait les pièces essentielles qui manquent (jante, aileron…), une génération par pièce,
 * d'après la photo du client recadrée sur la pièce (sinon Meshy refait toute la voiture).
 *
 * Garde-fous, pour que la facture ne s'emballe pas :
 * - rien ne part tout seul : le propriétaire voit les recadrages et clique ;
 * - au maximum 4 pièces par commande (MAX_PIECES), même en relançant ;
 * - plafonds par jour et par mois (MESHY_PIECES_DAILY_LIMIT, MESHY_PIECES_MONTHLY_LIMIT), comptés dans le stockage.
 * Le vrai plafond reste le solde du compte Meshy : ne pas activer la recharge automatique.
 */

const API = "https://api.meshy.ai/openapi/v1/image-to-3d";
const usage = usageCounter(
  "meshy",
  num(process.env.MESHY_PIECES_DAILY_LIMIT, 8),
  num(process.env.MESHY_PIECES_MONTHLY_LIMIT, 40)
);

export const meshyConfigured = () => Boolean(process.env.MESHY_API_KEY && storageEnabled());

export type PieceJob = {
  /** Rang de la pièce dans le 3e rapport (0 à 3). */
  index: number;
  piece: string;
  crop: string;
  status: "starting" | "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED" | "error";
  taskId?: string;
  progress?: number;
  glb?: string;
  thumb?: string;
  error?: string;
  startedAt: string;
};
export type Pieces = { jobs: PieceJob[] };

const path = (id: string) => `submissions/${id}/meshy-pieces.json`;
export const readPieces = async (id: string) => (await readJson<Pieces>(path(id))) ?? { jobs: [] };
const ended = (j: PieceJob) => ["SUCCEEDED", "FAILED", "CANCELED", "error"].includes(j.status);
export const piecesRunning = (p: Pieces | null) => Boolean(p?.jobs.some((j) => !ended(j) && !j.glb));

async function meshy(p: string, init?: RequestInit) {
  const res = await fetch(`${API}${p}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.MESHY_API_KEY}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || `Meshy a répondu ${res.status}`);
  return body;
}

/** Lance les pièces choisies (rangs du 3e rapport). Une pièce déjà lancée ne repart pas. */
export async function startPieces(id: string, indexes: number[]) {
  if (!meshyConfigured()) throw new Error("Meshy n'est pas branché (MESHY_API_KEY manquante dans Vercel)");
  const r3 = await readJson<Rapport3Rec>(`submissions/${id}/rapport3.json`);
  const list = r3?.result?.meshy ?? [];
  if (!list.length) throw new Error("Le 3e rapport ne demande aucune pièce Meshy");
  const state = await readPieces(id);
  // Une pièce qui a échoué peut être relancée ; elle compte quand même dans les 4 (c'est payé chez Meshy).
  const wanted = [...new Set(indexes)].filter((i) => i >= 0 && i < Math.min(list.length, MAX_PIECES) && r3?.crops?.[i]);
  const todo = wanted.filter((i) => !state.jobs.some((j) => j.index === i && !["FAILED", "CANCELED", "error"].includes(j.status)));
  if (!todo.length) throw new Error("Rien à lancer");
  if (state.jobs.length + todo.length > MAX_PIECES)
    throw new Error(`Plafond de ${MAX_PIECES} générations Meshy par commande atteint (${state.jobs.length} déjà lancée(s))`);

  for (const i of todo) {
    await usage.check();
    const job: PieceJob = { index: i, piece: list[i].piece, crop: r3!.crops![i]!, status: "starting", startedAt: new Date().toISOString() };
    // Réservation avant l'appel : un double clic ne lance pas deux générations payantes.
    state.jobs.push(job);
    await writeJson(path(id), state);
    try {
      const { data } = await readBytes(job.crop);
      const image_url = `data:image/jpeg;base64,${data.toString("base64")}`;
      // Sans texture : on repeint nous-mêmes, et ça coûte moins de crédits.
      const { result } = await meshy("", { method: "POST", body: JSON.stringify({ image_url, should_texture: false }) });
      job.status = "PENDING";
      job.taskId = result;
      await usage.add();
    } catch (e) {
      job.status = "error";
      job.error = (e as Error).message;
    }
    await writeJson(path(id), state);
  }
  return state;
}

/** Met à jour les pièces en cours ; une fois prête, copie le GLB dans le stockage (les liens Meshy expirent). */
export async function refreshPieces(id: string) {
  const state = await readPieces(id);
  let changed = false;
  for (const job of state.jobs) {
    if (!job.taskId || job.glb || ["FAILED", "CANCELED", "error"].includes(job.status)) continue;
    try {
      const t = await meshy(`/${job.taskId}`);
      job.status = t.status;
      job.progress = t.progress;
      job.error = undefined;
      if (t.status === "FAILED") job.error = t.task_error?.message || "Échec Meshy";
      const file = `submissions/${id}/meshy-piece-${job.index + 1}`;
      if (!job.thumb && t.thumbnail_url) {
        const img = await fetch(t.thumbnail_url).catch(() => null);
        if (img?.ok)
          job.thumb = (
            await put(`${file}.png`, Buffer.from(await img.arrayBuffer()), {
              access: BLOB_ACCESS,
              contentType: img.headers.get("content-type") || "image/png",
              addRandomSuffix: false,
              allowOverwrite: true,
            })
          ).pathname;
      }
      if (t.status === "SUCCEEDED" && t.model_urls?.glb) {
        const glb = await fetch(t.model_urls.glb);
        if (!glb.ok) throw new Error("Téléchargement du GLB impossible");
        job.glb = (
          await put(`${file}.glb`, Buffer.from(await glb.arrayBuffer()), {
            access: BLOB_ACCESS,
            contentType: "model/gltf-binary",
            addRandomSuffix: false,
            allowOverwrite: true,
          })
        ).pathname;
      }
    } catch (e) {
      // On garde la trace : sinon l'admin voit « 0 % » sans savoir pourquoi.
      job.error = `Suivi impossible : ${(e as Error).message}`;
    }
    changed = true;
  }
  if (changed) await writeJson(path(id), state);
  return state;
}
