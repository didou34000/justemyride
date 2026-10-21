import { put } from "@vercel/blob";
import { num, readBytes, readJson, usageCounter, writeJson } from "@/lib/blobJson";
import { BLOB_ACCESS, storageEnabled } from "@/lib/storage";
import type { Rapport3Rec } from "@/lib/rapports";
import { imageCount, imagePrompt, jobDone, jobImages, jobKind, MAX_3D, MAX_IMAGES, viewPrompt, vueDone, VUES, type PieceJob, type Pieces } from "@/lib/meshyShared";

export type { PieceJob, Pieces };

/**
 * Étape 8 : Meshy refait les pièces essentielles qui manquent (roue complète, aileron…), en deux temps par pièce,
 * chacun lancé par un bouton de l'admin :
 * 1. images : d'après la photo du client recadrée sur la pièce, Meshy dessine la pièce SEULE sur fond neutre, en 3 vues :
 *    la 3/4 d'abord, puis le côté et l'arrière d'après cette 3/4 (pour garder le même objet). Le prompt est modifiable ;
 * 2. 3D : Meshy construit la pièce d'après les vues retenues (multi-image-to-3d ; une photo de voiture lui ferait refaire le reste).
 *
 * Garde-fous, pour que la facture ne s'emballe pas :
 * - rien ne part tout seul : chaque étape part d'un clic ;
 * - au maximum 4 générations 3D par commande (MAX_3D) et 18 vues dessinées (MAX_IMAGES, soit 6 séries), échecs compris ;
 * - plafonds 3D par jour et par mois (MESHY_PIECES_DAILY_LIMIT, MESHY_PIECES_MONTHLY_LIMIT), comptés dans le stockage.
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

const path = (id: string) => `submissions/${id}/meshy-pieces.json`;
export const readPieces = async (id: string) => (await readJson<Pieces>(path(id))) ?? { jobs: [] };
const count3d = (p: Pieces) => p.jobs.filter((j) => jobKind(j) === "3d").length;
const countImages = (p: Pieces) => p.jobs.reduce((t, j) => t + imageCount(j), 0);

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

const copy = async (path: string, url: string, contentType: string) => {
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

const dataUri = async (pathname: string) => {
  const { data, type } = await readBytes(pathname);
  return `data:${type};base64,${data.toString("base64")}`;
};

const drawBody = async (prompt: string, refs: string[]) => ({
  ai_model: IMAGE_MODEL,
  prompt,
  reference_image_urls: await Promise.all(refs.map(dataUri)),
  aspect_ratio: "1:1",
  remove_background: true,
});

/** Lance une étape pour une pièce : les vues dessinées (avec le prompt donné) ou la 3D (d'après les vues retenues). */
export async function startPiece(id: string, index: number, kind: "image" | "3d", prompt?: string) {
  if (!meshyConfigured()) throw new Error("Meshy n'est pas branché (MESHY_API_KEY manquante dans Vercel)");
  const r3 = await readJson<Rapport3Rec>(`submissions/${id}/rapport3.json`);
  const item = r3?.result?.meshy[index];
  const crop = r3?.crops?.[index];
  if (!item || !crop) throw new Error("Pièce inconnue ou sans recadrage");
  const state = await readPieces(id);
  if (state.jobs.some((j) => j.index === index && jobKind(j) === kind && !jobDone(j)))
    throw new Error(kind === "image" ? "Un dessin est déjà en cours pour cette pièce" : "Une 3D est déjà en cours pour cette pièce");

  const job: PieceJob = { index, piece: item.piece, kind, crop, status: "starting", startedAt: new Date().toISOString() };
  let body: object;
  if (kind === "image") {
    if (countImages(state) + VUES.length > MAX_IMAGES) throw new Error(`Plafond de ${MAX_IMAGES} vues dessinées par commande atteint`);
    job.prompt = (prompt?.trim() || imagePrompt(item.piece, item.consigne)).slice(0, 3500);
    // Seule la 3/4 part maintenant ; le côté et l'arrière partent d'après elle, au suivi.
    job.vues = VUES.map((v) => ({ angle: v.key, status: "starting" }));
    body = await drawBody(viewPrompt(job.prompt, 0), [crop]);
  } else {
    if (count3d(state) >= MAX_3D) throw new Error(`Plafond de ${MAX_3D} générations 3D par commande atteint`);
    const picked = state.choixImage?.[index];
    const from =
      (picked !== undefined && jobImages(state.jobs[picked] ?? ({} as PieceJob)).length ? state.jobs[picked] : undefined) ??
      [...state.jobs].reverse().find((j) => j.index === index && jobKind(j) === "image" && jobImages(j).length);
    const images = from ? jobImages(from).slice(0, 4) : [];
    if (!images.length) throw new Error("Il faut d'abord des vues dessinées réussies de la pièce");
    await usage.check();
    job.image = images[0];
    job.images = images;
    job.endpoint = images.length > 1 ? "multi-image-to-3d" : "image-to-3d";
    const urls = await Promise.all(images.map(dataUri));
    // Sans texture : on repeint nous-mêmes, et ça coûte moins de crédits.
    body = images.length > 1 ? { image_urls: urls, should_texture: false } : { image_url: urls[0], should_texture: false };
  }
  // Réservation avant l'appel : un double clic ne lance pas deux générations payantes.
  state.jobs.push(job);
  await writeJson(path(id), state);
  try {
    const { result } = await meshy(kind === "image" ? "/image-to-image" : `/${job.endpoint}`, { method: "POST", body: JSON.stringify(body) });
    job.status = "PENDING";
    if (job.vues) Object.assign(job.vues[0], { status: "PENDING", taskId: result });
    else job.taskId = result;
    if (kind === "3d") await usage.add();
  } catch (e) {
    job.status = "error";
    job.error = (e as Error).message;
    job.vues?.forEach((v) => (v.status = "error"));
  }
  await writeJson(path(id), state);
  return state;
}

/** Suit les vues d'un job image ; une fois la 3/4 dessinée, lance le côté et l'arrière d'après elle. */
async function refreshVues(job: PieceJob, file: string) {
  const vues = job.vues!;
  for (const v of vues) {
    if (!v.taskId || vueDone(v)) continue;
    try {
      const t = await meshy(`/image-to-image/${v.taskId}`);
      v.status = t.status;
      v.progress = t.progress;
      v.error = t.status === "FAILED" ? t.task_error?.message || "Échec Meshy" : undefined;
      if (typeof t.consumed_credits === "number") v.credits = t.consumed_credits;
      if (t.status === "SUCCEEDED" && t.image_urls?.[0]) v.image = await copy(`${file}-${v.angle}.png`, t.image_urls[0], "image/png");
    } catch (e) {
      v.error = `Suivi impossible : ${(e as Error).message}`;
    }
  }
  const first = vues[0];
  for (const [k, v] of vues.entries()) {
    if (!k || v.taskId || vueDone(v)) continue;
    if (failed(first.status)) {
      v.status = "error";
      v.error = "La vue 3/4 a échoué";
    } else if (first.image) {
      try {
        const body = await drawBody(viewPrompt(job.prompt ?? "", k), [job.crop, first.image]);
        const { result } = await meshy("/image-to-image", { method: "POST", body: JSON.stringify(body) });
        Object.assign(v, { status: "PENDING", taskId: result });
      } catch (e) {
        v.status = "error";
        v.error = (e as Error).message;
      }
    }
  }
  job.image = first.image;
  job.credits = vues.reduce((t, v) => t + (v.credits ?? 0), 0);
  job.progress = Math.round(vues.reduce((t, v) => t + (v.image ? 100 : v.progress ?? 0), 0) / vues.length);
  job.status = vues.every(vueDone) ? (vues.some((v) => v.image) ? "SUCCEEDED" : "FAILED") : "IN_PROGRESS";
  job.error = job.status === "FAILED" ? first.error : undefined;
}
const failed = (s: string) => ["FAILED", "CANCELED", "error"].includes(s);

/** Met à jour les étapes en cours ; copie les résultats dans le stockage (les liens Meshy expirent). */
export async function refreshPieces(id: string) {
  const state = await readPieces(id);
  let changed = false;
  for (const [n, job] of state.jobs.entries()) {
    if (jobDone(job)) continue;
    const kind = jobKind(job);
    // Un fichier par essai : refaire une pièce n'écrase pas la précédente.
    const file = `submissions/${id}/meshy-piece-${job.index + 1}-${n + 1}`;
    if (job.vues) {
      await refreshVues(job, file);
      changed = true;
      continue;
    }
    // Ancien format : la tâche du dessin était dans imageTaskId.
    const task = kind === "image" ? job.taskId ?? job.imageTaskId : job.taskId;
    if (!task) continue;
    try {
      const t = await meshy(`/${kind === "image" ? "image-to-image" : job.endpoint ?? "image-to-3d"}/${task}`);
      job.status = t.status;
      job.progress = t.progress;
      job.error = t.status === "FAILED" ? t.task_error?.message || "Échec Meshy" : undefined;
      if (typeof t.consumed_credits === "number") job.credits = t.consumed_credits;
      if (kind === "image") {
        if (t.status === "SUCCEEDED" && t.image_urls?.[0]) job.image = await copy(`${file}-vue.png`, t.image_urls[0], "image/png");
      } else {
        if (!job.thumb && t.thumbnail_url) job.thumb = await copy(`${file}.png`, t.thumbnail_url, "image/png").catch(() => undefined);
        if (t.status === "SUCCEEDED" && t.model_urls?.glb) job.glb = await copy(`${file}.glb`, t.model_urls.glb, "model/gltf-binary");
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

/** Retient un dessin ou une 3D pour une pièce (job = n° dans la liste des jobs). */
export async function choosePiece(id: string, index: number, kind: "image" | "3d", job: number) {
  const state = await readPieces(id);
  const j = state.jobs[job];
  if (!j || j.index !== index || (kind === "image" ? !jobImages(j).length : !j.glb)) throw new Error("Résultat introuvable");
  const key = kind === "image" ? "choixImage" : "choix3d";
  state[key] = { ...state[key], [index]: job };
  await writeJson(path(id), state);
  return state;
}

