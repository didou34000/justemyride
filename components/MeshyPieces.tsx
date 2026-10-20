"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { photoSrc } from "@/lib/photo";
import GlbViewer from "./GlbViewer";
import { CREDITS, imagePrompt, jobDone, jobFailed, jobKind, MAX_3D, MAX_IMAGES, type PieceJob, type Pieces } from "@/lib/meshyShared";
import type { Rapport3 } from "@/lib/rapports";

/**
 * Bloc « Pièces Meshy » de l'admin : toutes les pièces à refaire, de haut en bas.
 * Pour chacune : le recadrage de la photo, le prompt (modifiable), puis deux boutons :
 * 1. « Faire l'image » : Meshy dessine la pièce seule de 3/4 ; 2. « Faire la pièce 3D » : d'après le dessin retenu.
 * Chaque essai reste visible ; on retient le meilleur dessin et la meilleure 3D.
 */
export default function MeshyPieces({ id, r3, crops, pieces }: { id: string; r3: Rapport3; crops?: (string | null)[]; pieces: Pieces }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [prompts, setPrompts] = useState<Record<number, string>>({});
  const n3d = pieces.jobs.filter((j) => jobKind(j) === "3d").length;
  const nImg = pieces.jobs.filter((j) => jobKind(j) === "image").length;
  // Crédits réellement facturés quand Meshy les donne, sinon le tarif (un échec est remboursé).
  const cost = (j: PieceJob) => j.credits ?? (jobFailed(j) ? 0 : CREDITS[jobKind(j)]);
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

  const status = (j: PieceJob) =>
    jobFailed(j) ? `Échec : ${j.error ?? j.status}` : `${jobKind(j) === "image" ? "Meshy dessine" : "Meshy construit la 3D"}… ${j.progress ?? 0} %`;

  return (
    <>
      <p className="sub">
        Pour chaque pièce : « Faire l&apos;image » envoie la photo recadrée à Meshy, qui dessine l&apos;élément seul de 3/4 (tu peux corriger le prompt avant).
        Quand le dessin te va, « Faire la pièce 3D » le construit en 3D. Tu retiens ensuite la meilleure 3D. Payant : {n3d}/{MAX_3D} générations 3D et {nImg}/{MAX_IMAGES} dessins
        utilisés pour cette commande.
      </p>
      <p className="sub">
        Prix : un dessin = {CREDITS.image} crédits, une 3D = {CREDITS["3d"]} crédits. Dépensé sur cette commande : <b>{total} crédits</b>.
      </p>
      {error && <p className="notice err">{error}</p>}
      <ol className="pieces">
        {r3.meshy.map((m, i) => {
          const crop = crops?.[i];
          const jobs = pieces.jobs.map((j, n) => ({ j, n })).filter(({ j }) => j.index === i);
          const images = jobs.filter(({ j }) => jobKind(j) === "image" || (j.image && !j.kind));
          const models = jobs.filter(({ j }) => jobKind(j) === "3d");
          const okImages = images.filter(({ j }) => j.image);
          const pickedImg = pieces.choixImage?.[i] ?? okImages.at(-1)?.n;
          const okModels = models.filter(({ j }) => j.glb);
          const picked3d = pieces.choix3d?.[i] ?? okModels.at(-1)?.n;
          const imgRunning = images.some(({ j }) => jobKind(j) === "image" && !jobDone(j));
          const modelRunning = models.some(({ j }) => !jobDone(j));
          const prompt = prompts[i] ?? imagePrompt(m.piece, m.consigne);
          return (
            <li key={i} className="piece">
              <h3 className="piece-head">
                {i + 1}. {m.piece}
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
                <label className="piece-prompt">
                  <span className="sub">Prompt envoyé à Meshy (dessin)</span>
                  <textarea value={prompt} rows={8} onChange={(e) => setPrompts((p) => ({ ...p, [i]: e.target.value }))} />
                </label>
              </div>
              <div className="admin-actions">
                <button
                  className="cta"
                  disabled={Boolean(busy) || !crop || imgRunning || nImg >= MAX_IMAGES}
                  onClick={() => act(`img${i}`, { piece: i, action: "image", prompt }, `Lancer un dessin Meshy payant pour « ${m.piece} » ?`)}
                >
                  {busy === `img${i}` ? "Envoi…" : imgRunning ? "Dessin en cours…" : okImages.length ? "1. Refaire l'image" : "1. Faire l'image"} · {CREDITS.image} cr.
                </button>
                <button
                  className="cta"
                  disabled={Boolean(busy) || pickedImg === undefined || modelRunning || n3d >= MAX_3D}
                  onClick={() =>
                    act(`3d${i}`, { piece: i, action: "3d" }, `Lancer une génération 3D Meshy payante pour « ${m.piece} » ? (${n3d}/${MAX_3D} déjà utilisées)`)
                  }
                >
                  {busy === `3d${i}` ? "Envoi…" : modelRunning ? "3D en cours…" : okModels.length ? "2. Refaire la pièce 3D" : "2. Faire la pièce 3D"} · {CREDITS["3d"]} cr.
                </button>
              </div>

              {images.length > 0 && (
                <>
                  <p className="sub">Dessins : clique sur celui qui part en 3D.</p>
                  <div className="piece-results">
                    {images.map(({ j, n }) =>
                      j.image ? (
                        <button
                          key={n}
                          type="button"
                          className={`piece-result${n === pickedImg ? " is-picked" : ""}`}
                          title={j.prompt}
                          onClick={() => n !== pickedImg && act(`ci${n}`, { piece: i, action: "choisir-image", job: n })}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img className="meshy-thumb" src={photoSrc(j.image)} alt={`Dessin : ${m.piece}`} />
                          <span>
                            {n === pickedImg ? "✓ Retenu" : "Retenir"} · {cost(j)} cr.
                          </span>
                        </button>
                      ) : (
                        <div key={n} className="piece-result glb-viewer">
                          <span>{status(j)}</span>
                        </div>
                      )
                    )}
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
