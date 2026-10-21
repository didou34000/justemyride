"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { photoSrc } from "@/lib/photo";
import GlbViewer from "./GlbViewer";
import { CREDITS, DEFAULT_IMAGE_MODEL, IMAGE_MODELS, viewCredits, type ImageModel, imageCount, imagePrompt, jobDone, jobFailed, jobImages, jobKind, count3dOf, MAX_IMAGES, TYPES_3D, VUES, type PieceJob, type Pieces, type Vue, viewPrompt } from "@/lib/meshyShared";
import type { Rapport3 } from "@/lib/rapports";

/**
 * Bloc « Pièces Meshy » de l'admin : toutes les pièces à refaire, de haut en bas.
 * Pour chacune : le recadrage de la photo, le prompt (modifiable), puis deux boutons :
 * 1. « Faire les images » : Meshy dessine la pièce seule en 2 images, de face puis de côté, chacune avec son prompt ;
 * 2. « Faire la pièce 3D » : d'après les 2 images retenues.
 * Chaque essai reste visible ; on retient le meilleur dessin et la meilleure 3D.
 */
/** Libellés des anciennes vues (3/4, arrière). */
const OLD_LABELS: Record<string, string> = { "34": "3/4", arriere: "Arrière" };
const jobFailedVue = (v: Vue) => ["FAILED", "CANCELED", "error"].includes(v.status);

export default function MeshyPieces({ id, r3, crops, pieces }: { id: string; r3: Rapport3; crops?: (string | null)[]; pieces: Pieces }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [imageModels, setImageModels] = useState<Record<number, ImageModel>>({});
  const n3d = { piece: count3dOf(pieces, "piece"), sticker: count3dOf(pieces, "sticker") };
  const nImg = pieces.jobs.reduce((t, j) => t + imageCount(j), 0);
  // Crédits réellement facturés quand Meshy les donne, sinon le tarif (un échec est remboursé).
  const cost = (j: PieceJob) =>
    j.credits || (jobFailed(j) ? 0 : jobKind(j) === "image" ? viewCredits(j) * (j.vues?.filter((v) => !jobFailedVue(v)).length ?? 1) : CREDITS["3d"]);
  const total = pieces.jobs.reduce((t, j) => t + cost(j), 0);

  async function act(key: string, body: object, confirm?: string) {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(key);
    setError("");
    try {
      const res = await fetch("/api/meshy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `Erreur ${res.status}`);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy("");
    router.refresh();
  }

  const vueStatus = (v: Vue) =>
    jobFailedVue(v) ? `Échec : ${v.error ?? v.status}` : v.taskId ? `Meshy dessine… ${v.progress ?? 0} %` : "Attend l'image de face";
  const status = (j: PieceJob) =>
    jobFailed(j) ? `Échec : ${j.error ?? j.status}` : `${jobKind(j) === "image" ? "Meshy dessine" : "Meshy construit la 3D"}… ${j.progress ?? 0} %`;

  return (
    <>
      <p className="sub">
        Pour chaque pièce : « Faire les images » envoie la photo recadrée à Meshy, qui dessine l&apos;élément seul en 2 images : de face (complet), puis de
        côté d&apos;après l&apos;image de face, pour voir la largeur. Chaque image a son prompt, que tu peux corriger avant. Quand les 2 images te vont, « Faire la
        pièce 3D » construit la 3D d&apos;après les deux. Tu retiens ensuite la meilleure 3D. Payant :{" "}
        {n3d.piece}/{TYPES_3D.piece.max} générations 3D de pièces, {n3d.sticker}/{TYPES_3D.sticker.max} de stickers et {nImg}/{MAX_IMAGES} images
        dessinées utilisées pour cette commande. Un sticker n&apos;a qu&apos;une image (de face) et garde ses couleurs en 3D (≈{CREDITS["3d"] + 10} cr.).
      </p>
      <p className="sub">
        Prix : les 2 images = {IMAGE_MODELS["nano-banana"].credits * VUES.length} crédits en Standard, {IMAGE_MODELS["nano-banana-pro"].credits * VUES.length} en
        Pro ; une 3D ≈ {CREDITS["3d"]} crédits (Meshy ne publie pas le prix exact à partir de 2 images : le vrai montant s&apos;affiche une fois facturé). Dépensé sur cette commande : <b>{total} crédits</b>.
      </p>
      {error && <p className="notice err">{error}</p>}
      <ol className="pieces">
        {r3.meshy.map((m, i) => {
          const crop = crops?.[i];
          const jobs = pieces.jobs.map((j, n) => ({ j, n })).filter(({ j }) => j.index === i);
          const images = jobs.filter(({ j }) => jobKind(j) === "image" || (j.image && !j.kind));
          const models = jobs.filter(({ j }) => jobKind(j) === "3d");
          const okImages = images.filter(({ j }) => jobDone(j) && jobImages(j).length > 0);
          const pickedImg = pieces.choixImage?.[i] ?? okImages.at(-1)?.n;
          const okModels = models.filter(({ j }) => j.glb);
          const picked3d = pieces.choix3d?.[i] ?? okModels.at(-1)?.n;
          const imgRunning = images.some(({ j }) => jobKind(j) === "image" && !jobDone(j));
          const modelRunning = models.some(({ j }) => !jobDone(j));
          const type = m.type ?? "piece";
          const vues = type === "sticker" ? VUES.slice(0, 1) : VUES;
          const base = imagePrompt(m.piece, m.consigne, type);
          const viewPrompts = vues.map((_, k) => prompts[`${i}-${k}`] ?? viewPrompt(base, k));
          const used = n3d[type];
          const max = TYPES_3D[type].max;
          const model = imageModels[i] ?? DEFAULT_IMAGE_MODEL;
          const imageCost = IMAGE_MODELS[model].credits * vues.length;
          return (
            <li key={i} className="piece">
              <h3 className="piece-head">
                {i + 1}. {m.piece} {type === "sticker" && <span className="chip on">Sticker</span>}
              </h3>
              <p className="sub">
                {m.consigne} · photo « {m.photo} »
              </p>
              <div className="piece-row">
                <div className="piece-crop">
                  {crop ? (
                    <a href={photoSrc(crop)} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="meshy-thumb" src={photoSrc(crop)} alt={`Recadrage : ${m.piece}`} />
                    </a>
                  ) : (
                    <p className="notice err">Recadrage impossible (photo « {m.photo} » introuvable).</p>
                  )}
                </div>
                <div className="piece-prompt">
                  {vues.map((v, k) => (
                    <label key={v.key}>
                      <span className="sub">
                        Prompt de l&apos;image {k + 1} · {v.label}
                      </span>
                      <textarea value={viewPrompts[k]} rows={7} onChange={(e) => setPrompts((p) => ({ ...p, [`${i}-${k}`]: e.target.value }))} />
                    </label>
                  ))}
                </div>
              </div>
              <div className="admin-actions">
                <label className="sub">
                  Modèle de l&apos;image{" "}
                  <select value={model} onChange={(e) => setImageModels((p) => ({ ...p, [i]: e.target.value as ImageModel }))}>
                    {Object.entries(IMAGE_MODELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label} · {v.credits} cr.
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="cta"
                  disabled={Boolean(busy) || !crop || imgRunning || nImg >= MAX_IMAGES}
                  onClick={() =>
                    act(`img${i}`, { piece: i, action: "image", prompt: base, prompts: viewPrompts, model }, `Lancer ${vues.length > 1 ? "2 images Meshy, de face et de côté" : "1 image Meshy, de face"} (${imageCost} crédits) pour « ${m.piece} » ?`)
                  }
                >
                  {busy === `img${i}` ? "Envoi…" : imgRunning ? "Images en cours…" : okImages.length ? "1. Refaire les images" : "1. Faire les images"} ·{" "}
                  {imageCost} cr.
                </button>
                <button
                  className="cta"
                  disabled={Boolean(busy) || pickedImg === undefined || modelRunning || used >= max}
                  onClick={() =>
                    act(`3d${i}`, { piece: i, action: "3d" }, `Lancer une génération 3D Meshy payante pour « ${m.piece} » ? (${used}/${max} ${TYPES_3D[type].label.toLowerCase()}s déjà faits)`)
                  }
                >
                  {busy === `3d${i}` ? "Envoi…" : modelRunning ? "3D en cours…" : okModels.length ? "2. Refaire la pièce 3D" : "2. Faire la pièce 3D"} · ≈{" "}
                  {CREDITS["3d"] + (type === "sticker" ? 10 : 0)} cr.
                </button>
              </div>

              {images.length > 0 && (
                <>
                  <p className="sub">Images : retiens la paire qui part en 3D.</p>
                  <div className="piece-sets">
                    {images.map(({ j, n }) => {
                      const vues: Vue[] = j.vues ?? [{ angle: "34", status: j.status, progress: j.progress, image: j.image, error: j.error, taskId: j.taskId ?? j.imageTaskId }];
                      const ok = jobImages(j).length > 0;
                      return (
                        <div key={n} className={`piece-set${n === pickedImg ? " is-picked" : ""}`}>
                          <div className="piece-set-vues">
                            {vues.map((v) => (
                              <figure key={v.angle}>
                                {v.image ? (
                                  <a href={photoSrc(v.image)} target="_blank" rel="noreferrer">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img className="meshy-thumb" src={photoSrc(v.image)} alt={`${m.piece} : ${v.angle}`} />
                                  </a>
                                ) : (
                                  <div className="glb-viewer">
                                    <span>{vueStatus(v)}</span>
                                  </div>
                                )}
                                <figcaption>{VUES.find((x) => x.key === v.angle)?.label ?? OLD_LABELS[v.angle]}</figcaption>
                              </figure>
                            ))}
                          </div>
                          <div className="piece-result-foot">
                            <button
                              type="button"
                              className="link"
                              disabled={!ok || n === pickedImg || Boolean(busy) || !jobDone(j)}
                              onClick={() => act(`ci${n}`, { piece: i, action: "choisir-image", job: n })}
                            >
                              {n === pickedImg ? "✓ Retenue pour la 3D" : "Retenir ces images"}
                            </button>
                            <span className="sub">{cost(j)} cr.</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {models.length > 0 && (
                <>
                  <p className="sub">Pièces 3D : retiens la bonne pour l&apos;assemblage.</p>
                  <div className="piece-results">
                    {models.map(({ j, n }) => (
                      <div key={n} className={`piece-result${n === picked3d ? " is-picked" : ""}`}>
                        {j.glb ? (
                          <>
                            <GlbViewer src={photoSrc(j.glb)} />
                            <div className="piece-result-foot">
                              <button
                                type="button"
                                className="link"
                                disabled={n === picked3d || Boolean(busy)}
                                onClick={() => act(`c3${n}`, { piece: i, action: "choisir-3d", job: n })}
                              >
                                {n === picked3d ? "✓ Retenue" : "Retenir celle-ci"}
                              </button>
                              <span className="sub">{cost(j)} cr.</span>
                              <a className="link" href={photoSrc(j.glb)} download={`piece-${i + 1}-${n + 1}-${id}.glb`}>
                                .glb
                              </a>
                            </div>
                          </>
                        ) : (
                          <div className="glb-viewer">
                            <span>{status(j)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
