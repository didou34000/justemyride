import { put } from "@vercel/blob";
import { num, readBytes, readJson, usageCounter, writeJson } from "@/lib/blobJson";
import { BLOB_ACCESS, storageEnabled } from "@/lib/storage";
import { MAX_PIECES, type Rapport3Rec } from "@/lib/rapports";

/**
 * Étape 8 : Meshy refait les pièces essentielles qui manquent (jante, aileron…), en deux temps par pièce :
 * 1. image : d'après la photo du client recadrée sur la pièce, Meshy dessine la pièce SEULE, de 3/4, sur fond neutre ;
 * 2. 3D : Meshy construit la pièce en 3D d'après ce dessin (une photo de voiture lui ferait refaire le reste autour).
 *
 * Garde-fous, pour que la facture ne s'emballe pas :
 * - rien ne part tout seul : le propriétaire voit les recadrages et clique ;
 * - au maximum 4 pièces par commande (MAX_PIECES), même en relançant ;
 * - plafonds par jour et par mois (MESHY_PIECES_DAILY_LIMIT, MESHY_PIECES_MONTHLY_LIMIT), comptés dans le stockage.
 * Le vrai plafond reste le solde du compte Meshy : ne pas activer la recharge automatique.
 */

const API = "https://api.meshy.ai/openapi/v1";
/** Modèle d'image de Meshy pour isoler la pièce (nano-banana-pro : 9 crédits l'image, le plus fidèle des Nano Banana). */
const IMAGE_MODEL = process.env.MESHY_IMAGE_MODEL || "nano-banana-pro";
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
  /** Où en est la pièce : le dessin de la pièce seule, puis la 3D. Absent = ancien job, directement en 3D. */
  stage?: "image" | "3d";
  imageTaskId?: string;
  /** Le dessin de la pièce seule de 3/4 (copié dans le stockage). */
  image?: string;
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
const failed = (j: PieceJob) => ["FAILED", "CANCELED", "error"].includes(j.status);
export const piecesRunning = (p: Pieces | null) => Boolean(p?.jobs.some((j) => !failed(j) && !j.glb));

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

/** La consigne donnée au modèle d'image : la pièce seule, de 3/4, exactement comme sur la photo. */
const imagePrompt = (piece: string, consigne: string) =>
  `Extract only the ${piece} visible in the reference photo and show it alone, as a single isolated object: ` +
  `three-quarter view, centered, the whole part visible, plain white background, soft studio light, product shot. ` +
  `Reproduce it exactly as in the photo: same design, same shapes, same number of spokes or slats, same proportions and details. ` +
  `No car body, no other parts, no text, no shadow. Details (French): ${consigne}`;

const put2 = async (path: string, url: string, contentType: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Téléchargement chez Meshy impossible");
  return (
    await put(path, Buffer.from(await res.arrayBuffer()), {
      access: BLOB_ACCESS,
      contentType: res.headers.get("content-type") || contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    })
  ).pathname;
};

/** Lance les pièces choisies (rangs du 3e rapport). Une pièce en cours ne repart pas ; une pièce finie peut être refaite. */
export async function startPieces(id: string, indexes: number[]) {
  if (!meshyConfigured()) throw new Error("Meshy n'est pas branché (MESHY_API_KEY manquante dans Vercel)");
  const r3 = await readJson<Rapport3Rec>(`submissions/${id}/rapport3.json`);
  const list = r3?.result?.meshy ?? [];
  if (!list.length) throw new Error("Le 3e rapport ne demande aucune pièce Meshy");
  const state = await readPieces(id);
  // Une pièce ratée ou décevante peut être refaite ; chaque essai compte dans les 4 (c'est payé chez Meshy).
  const wanted = [...new Set(indexes)].filter((i) => i >= 0 && i < Math.min(list.length, MAX_PIECES) && r3?.crops?.[i]);
  const todo = wanted.filter((i) => !state.jobs.some((j) => j.index === i && !failed(j) && !j.glb));
  if (!todo.length) throw new Error("Rien à lancer");
  if (state.jobs.length + todo.length > MAX_PIECES)
    throw new Error(`Plafond de ${MAX_PIECES} générations Meshy par commande atteint (${state.jobs.length} déjà lancée(s))`);

  for (const i of todo) {
    await usage.check();
    const job: PieceJob = { index: i, piece: list[i].piece, crop: r3!.crops![i]!, stage: "image", status: "starting", startedAt: new Date().toISOString() };
    // Réservation avant l'appel : un double clic ne lance pas deux générations payantes.
    state.jobs.push(job);
    await writeJson(path(id), state);
    try {
      const { data } = await readBytes(job.crop);
      const photo = `data:image/jpeg;base64,${data.toString("base64")}`;
      const { result } = await meshy("/image-to-image", {
        method: "POST",
        body: JSON.stringify({
          ai_model: IMAGE_MODEL,
          prompt: imagePrompt(list[i].piece, list[i].consigne),
          reference_image_urls: [photo],
          aspect_ratio: "1:1",
          remove_background: true,
        }),
      });
      job.status = "PENDING";
      job.imageTaskId = result;
      // Le plafond compte les pièces (dessin + 3D), comptées dès le départ.
      await usage.add();
    } catch (e) {
      job.status = "error";
      job.error = (e as Error).message;
    }
    await writeJson(path(id), state);
  }
  return state;
}

/** Met à jour les pièces en cours : dessin fini → lance la 3D ; 3D finie → copie le GLB (les liens Meshy expirent). */
export async function refreshPieces(id: string) {
  const state = await readPieces(id);
  let changed = false;
  for (const job of state.jobs) {
    if (job.glb || failed(job)) continue;
    // Un fichier par essai : refaire une pièce n'écrase pas la précédente.
    const file = `submissions/${id}/meshy-piece-${job.index + 1}-${state.jobs.indexOf(job) + 1}`;
    try {
      if (job.stage === "image") {
        if (!job.imageTaskId) continue;
        const t = await meshy(`/image-to-image/${job.imageTaskId}`);
        job.status = t.status;
        job.progress = t.progress;
        job.error = undefined;
        if (t.status === "FAILED") job.error = `Dessin de la pièce : ${t.task_error?.message || "échec Meshy"}`;
        const url: string | undefined = t.image_urls?.[0];
        if (t.status === "SUCCEEDED" && url) {
          job.image = await put2(`${file}-vue.png`, url, "image/png");
          // Sans texture : on repeint nous-mêmes, et ça coûte moins de crédits.
          const r = await meshy("/image-to-3d", { method: "POST", body: JSON.stringify({ image_url: url, should_texture: false }) });
          job.stage = "3d";
          job.taskId = r.result;
          job.status = "PENDING";
          job.progress = 0;
        }
      } else {
        if (!job.taskId) continue;
        const t = await meshy(`/image-to-3d/${job.taskId}`);
        job.status = t.status;
        job.progress = t.progress;
        job.error = undefined;
        if (t.status === "FAILED") job.error = t.task_error?.message || "Échec Meshy";
        if (!job.thumb && t.thumbnail_url) job.thumb = await put2(`${file}.png`, t.thumbnail_url, "image/png").catch(() => undefined);
        if (t.status === "SUCCEEDED" && t.model_urls?.glb) job.glb = await put2(`${file}.glb`, t.model_urls.glb, "model/gltf-binary");
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
