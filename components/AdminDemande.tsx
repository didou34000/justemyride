"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { upload, uploadPresigned } from "@vercel/blob/client";
import { BLOB_ACCESS } from "@/lib/storage";
import { useRouter } from "next/navigation";
import { Flow, StepIcon } from "./Flow";
import { photoSrc } from "@/lib/photo";
import LiveRefresh from "./LiveRefresh";
import GlbViewer from "./GlbViewer";
import { renderViews } from "./renderViews";
import { meshyPhotos, STEPS } from "@/lib/steps";
import type { Order } from "@/lib/orders";

const TRAITEMENT: Record<string, string> = {
  couleur: "Peinture",
  decalque: "Décalque",
  piece_3d: "Pièce 3D",
  a_verifier: "À vérifier",
};

const SOLUTION: Record<string, string> = {
  sketchfab: "Pièce Sketchfab",
  decalque: "Décalque",
  a_modeliser: "À modéliser",
  ignorer: "Ignorable",
};

const day = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";

/** Page du propriétaire pour une demande : le circuit en blocs, et le détail du bloc choisi. */
export default function AdminDemande({ order }: { order: Order }) {
  const router = useRouter();
  const { id, demande, analyse, meshy, details, meshyLogos, meshySplit, fichiers, badges: lib, suivi, steps } = order;
  const first = steps.find((s) => s.state === "error" || s.state === "current")?.key ?? "photos";
  const [sel, setSel] = useState(first);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const r = analyse?.result;
  const step = steps.find((s) => s.key === sel)!;
  const def = STEPS.find((s) => s.key === sel)!;
  const meshyRunning = Boolean(meshy && !meshy.glb && meshy.taskId && !["SUCCEEDED", "FAILED", "CANCELED", "error"].includes(meshy.status));
  const splitRunning = Boolean(meshySplit && !meshySplit.glb && !["SUCCEEDED", "FAILED", "CANCELED", "error"].includes(meshySplit.status));
  const splitFailed = Boolean(meshySplit && ["FAILED", "CANCELED", "error"].includes(meshySplit.status));
  const analyseBusy = Boolean(steps.find((s) => s.key === "analyse")?.busy);
  const detailsBusy = Boolean(steps.find((s) => s.key === "details")?.busy);
  const running = analyseBusy || meshyRunning || detailsBusy || splitRunning;
  const x = details?.result;
  const badges = x?.manques.filter((b) => b.type === "logo_marque" || b.type === "badge_texte") ?? [];

  const pieces = r?.differences.filter((d) => d.traitement === "piece_3d") ?? [];
  const meshyInputs =
    meshy?.inputs ??
    meshyPhotos(demande.files);

  // Générations finies avant qu'on garde l'aperçu : on va le chercher une fois chez Meshy.
  const needThumb = Boolean(meshy?.glb && !meshy.thumb && meshy.taskId);
  useEffect(() => {
    if (needThumb) fetch(`/api/meshy?id=${id}`).then(() => router.refresh()).catch(() => null);
  }, [needThumb, id, router]);

  // Contrôle des détails : on rend 4 vues du modèle ici (le serveur ne sait pas faire de 3D), puis Claude compare.
  async function checkDetails() {
    if (!meshy?.glb) return;
    setBusy("details");
    setError("");
    try {
      const views = await renderViews(photoSrc(meshy.glb));
      const res = await fetch("/api/details", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, views }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? `Erreur ${res.status}`);
    } catch (e) {
      setError(`Rendu des vues impossible : ${(e as Error).message}`);
    }
    setBusy("");
    router.refresh();
  }

  // Dès que le modèle Meshy est là et qu'aucun contrôle n'a été fait, on le lance une fois tout seul.
  const autoDetails = Boolean(meshy?.glb && !details);
  const [autoDone, setAutoDone] = useState(false);
  useEffect(() => {
    if (autoDetails && !autoDone) {
      setAutoDone(true);
      checkDetails();
    }
  });

  // Dépôt d'un fichier par le propriétaire : envoi direct vers le stockage, puis enregistrement dans la demande.
  async function pick(e: ChangeEvent<HTMLInputElement>, kind: "logos" | "final") {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(kind);
    setError("");
    try {
      const { mode } = await fetch("/api/storage").then((r) => r.json());
      const ext = kind === "final" ? "glb" : (file.name.split(".").pop()?.toLowerCase() ?? "png").replace("jpeg", "jpg");
      const send = mode === "oidc" ? uploadPresigned : upload;
      const blob = await send(`submissions/${id}/${kind}.${ext}`, file, {
        access: BLOB_ACCESS,
        handleUploadUrl: "/api/admin/upload",
        contentType: kind === "final" ? "model/gltf-binary" : file.type,
        multipart: mode === "token" && file.size > 20 * 1024 * 1024,
      });
      const res = await fetch("/api/admin/fichier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, kind, pathname: blob.pathname }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `Erreur ${res.status}`);
    } catch (err) {
      setError(`Envoi impossible : ${(err as Error).message}`);
    }
    setBusy("");
    router.refresh();
  }

  async function call(label: string, url: string, body: unknown, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(label);
    setError("");
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) setError(d.error ?? `Erreur ${res.status}`);
    router.refresh();
  }

  return (
    <section className="admin wide">
      <div className="admin-top">
        <div>
          <p className="eyebrow">Demande du {day(demande.receivedAt)}</p>
          <h2>{demande.car || demande.base?.label || "Voiture"}</h2>
          <p className="sub">
            <a className="link" href={`mailto:${demande.email}`}>{demande.email}</a>
            {demande.base?.uid && (
              <>
                {" · "}
                <a className="link" href={`https://sketchfab.com/3d-models/${demande.base.uid}`} target="_blank" rel="noreferrer">
                  modèle de base
                </a>
              </>
            )}
          </p>
        </div>
        <LiveRefresh
          every={running ? 8 : 30}
          poll={meshyRunning ? `/api/meshy?id=${id}` : splitRunning ? `/api/meshy?id=${id}&kind=split` : undefined}
        />
      </div>

      <Flow
        steps={steps}
        order={order}
        selected={sel}
        onSelect={(k) => {
          setSel(k);
          // Sur téléphone, le détail est sous le circuit : on y descend.
          if (window.matchMedia("(max-width: 640px)").matches)
            setTimeout(() => document.getElementById("node-panel")?.scrollIntoView({ behavior: "smooth" }), 50);
        }}
      />

      <div id="node-panel" className={`node-panel t-${def.tone}`}>
        <div className="node-panel-head">
          <span className="node-icon">
            <StepIcon k={sel} />
          </span>
          <div>
            <strong>{def.label}</strong>
            <span className="sub">
              {def.who} · {def.help}
            </span>
          </div>
        </div>

        {sel === "photos" && (
          <div className="admin-photos">
            {demande.files.map((f) => (
              <a key={f.pathname} href={photoSrc(f.pathname)} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoSrc(f.pathname)} alt={f.slot} loading="lazy" />
                <span>{f.slot}</span>
              </a>
            ))}
          </div>
        )}

        {sel === "analyse" && (
          <>
            {!analyse && <p className={`notice ${step.state === "error" ? "err" : ""}`}>{step.state === "error" ? step.note : "Pas encore analysée."}</p>}
            {analyseBusy && <p className="notice">Claude regarde les photos, le résultat s&apos;affiche ici tout seul.</p>}
            {analyse && step.state === "error" && <p className="notice err">Analyse impossible : {analyse.error ?? step.note}</p>}
            {r && (
              <>
                <p className="admin-resume">{r.resume}</p>
                <p className={`notice ${r.base_ok ? "" : "err"}`}>
                  <b>Base {r.base_ok ? "OK" : "à revoir"} :</b> {r.base_remarque}
                </p>
                <p className="sub">
                  Couleurs : carrosserie {r.couleurs.carrosserie}, toit {r.couleurs.toit}, jantes {r.couleurs.jantes}
                  {r.couleurs.autres ? `, ${r.couleurs.autres}` : ""}
                </p>
                <div className="admin-diffs">
                  {r.differences.map((d, i) => (
                    <div key={i} className={`admin-diff conf-${d.confiance}`}>
                      <div className="admin-diff-head">
                        <strong>{d.piece}</strong>
                        <span className="chip on">{TRAITEMENT[d.traitement] ?? d.traitement}</span>
                      </div>
                      <p>{d.description}</p>
                      <span className="sub">Confiance {d.confiance} · photos : {d.photos.join(", ") || "?"}</span>
                    </div>
                  ))}
                  {!r.differences.length && <p className="notice">Aucune différence : la base d&apos;origine suffit.</p>}
                </div>
                {r.photos_a_demander.length > 0 && (
                  <>
                    <h4>Photos à demander au client</h4>
                    <ul className="admin-list">{r.photos_a_demander.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  </>
                )}
                {r.alertes.length > 0 && (
                  <>
                    <h4>Alertes</h4>
                    <ul className="admin-list">{r.alertes.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  </>
                )}
              </>
            )}
            <div className="admin-actions">
              <button
                className="cta ghost"
                disabled={Boolean(busy) || analyseBusy}
                onClick={() => call("analyse", "/api/analyse", { id, force: Boolean(analyse) })}
              >
                {busy === "analyse" ? "Analyse…" : analyse ? "Refaire l'analyse" : "Lancer l'analyse"}
              </button>
            </div>
          </>
        )}

        {sel === "pieces" && (
          <>
            {pieces.length > 0 && (
              <>
                <h4>Pièces différentes repérées par Claude</h4>
                <ul className="admin-list">
                  {pieces.map((d, i) => (
                    <li key={i}>
                      <b>{d.piece}</b> : {d.description}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="meshy-io">
              <div className="meshy-col">
                <h4>{meshy ? "Envoyé à Meshy" : "Sera envoyé à Meshy"}</h4>
                <div className="meshy-in">
                  {meshyInputs.map((p) => (
                    <a key={p} href={photoSrc(p)} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoSrc(p)} alt="" loading="lazy" />
                      <span>{demande.files.find((f) => f.pathname === p)?.slot}</span>
                    </a>
                  ))}
                </div>
                <p className="sub">
                  Multi-vues, {meshyInputs.length} photo{meshyInputs.length > 1 ? "s" : ""} de la voiture entière, texture{" "}
                  {meshy?.texture ? "oui" : "non (on repeint nous-mêmes)"}.
                </p>
                <p className="notice">
                  Pour l&apos;instant, Meshy reçoit la voiture entière. L&apos;envoi pièce par pièce (une planche avec l&apos;aileron, les jantes…) n&apos;est
                  pas encore fait.
                </p>
              </div>
              <span className="meshy-arrow" aria-hidden>→</span>
              <div className="meshy-col">
                <h4>Rendu Meshy</h4>
                {meshy?.glb ? (
                  <>
                    <GlbViewer src={photoSrc(meshy.glb)} />
                    <p className="sub">
                      Tourne autour à la souris.{" "}
                      <a className="link" href={photoSrc(meshy.glb)} download={`meshy-${id}.glb`}>Télécharger le .glb</a>
                    </p>
                  </>
                ) : meshy?.thumb ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img className="meshy-thumb" src={photoSrc(meshy.thumb)} alt="Aperçu Meshy" />
                ) : (
                  <div className="glb-viewer">
                    <span>
                      {!meshy
                        ? "Pas encore lancé."
                        : step.state === "error"
                          ? `Échec : ${meshy.error ?? meshy.status}`
                          : `Meshy travaille… ${meshy.progress ?? 0} %`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <h4>Découpe en pièces</h4>
            <p className="sub">
              Meshy découpe la voiture selon les couleurs des photos (carrosserie, toit, vitres, phares, calandre, jantes, pneus, feux, plaques, plastiques
              noirs). Chaque pièce reçoit ensuite sa couleur exacte, au lieu de zones devinées à l&apos;œil.
            </p>
            {meshySplit?.glb ? (
              <GlbViewer src={photoSrc(meshySplit.glb)} colors />
            ) : meshySplit ? (
              <div className="glb-viewer">
                <span>
                  {splitFailed
                    ? `Échec : ${meshySplit.error ?? meshySplit.status}`
                    : meshySplit.status === "PENDING" || meshySplit.status === "starting"
                      ? "En file d'attente chez Meshy…"
                      : `Meshy découpe… ${meshySplit.progress ?? 0} %`}
                  {!splitFailed && meshySplit.error ? ` (${meshySplit.error})` : ""}
                </span>
              </div>
            ) : null}
            {meshy?.autoSplit && !meshySplit && meshy.splitError && <p className="notice err">Découpe automatique impossible : {meshy.splitError}</p>}
            {meshy?.autoSplit && !meshySplit && !meshy.splitError && <p className="sub">La découpe partira toute seule dès que le modèle sera prêt.</p>}

            <div className="admin-actions">
              {!meshy ? (
                <>
                  <button
                    className="cta"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      call(
                        "meshy",
                        "/api/meshy",
                        { id, split: true },
                        "Générer la voiture en 3D puis la découper en pièces ? (payant : génération Meshy + 10 crédits pour la découpe)",
                      )
                    }
                  >
                    {busy === "meshy" ? "Lancement…" : "Générer et découper en pièces"}
                  </button>
                  <button
                    className="cta ghost"
                    disabled={Boolean(busy)}
                    onClick={() => call("meshy", "/api/meshy", { id }, "Lancer une génération Meshy payante à partir des 4 faces de la voiture ?")}
                  >
                    Générer d&apos;un bloc
                  </button>
                </>
              ) : (
                <button
                  className="cta ghost"
                  disabled={Boolean(busy) || !meshy.glb || Boolean(meshySplit) || Boolean(meshy.autoSplit && !meshy.splitError)}
                  onClick={() => call("split", "/api/meshy", { id, kind: "split" }, "Découper le modèle Meshy en pièces ? (payant : 10 crédits Meshy)")}
                >
                  {meshySplit ? "Découpe lancée" : busy === "split" ? "Lancement…" : "Découper en pièces (Meshy, 10 crédits)"}
                </button>
              )}
            </div>
          </>
        )}

        {sel === "details" && (
          <>
            {!meshy?.glb && <p className="notice">Il faut d&apos;abord le modèle Meshy (bloc Pièces 3D).</p>}
            {(detailsBusy || busy === "details") && (
              <p className="notice">Claude compare le modèle Meshy aux photos, le résultat s&apos;affiche ici tout seul.</p>
            )}
            {step.state === "error" && <p className="notice err">Contrôle impossible : {details?.error ?? step.note}</p>}
            {x && (
              <>
                <p className="admin-resume">{x.resume}</p>
                <div className="admin-diffs">
                  {x.manques.map((d, i) => (
                    <div key={i} className={`admin-diff imp-${d.importance}`}>
                      <div className="admin-diff-head">
                        <strong>{d.detail}</strong>
                        <span className="chip on">{SOLUTION[d.solution] ?? d.solution}</span>
                      </div>
                      <p>{d.ou}</p>
                      {d.type === "logo_marque" && (
                        <p className="notice warn">Logo de marque déposée : on ne le reproduit pas tel quel. À toi de décider (décalque générique, monogramme, ou rien).</p>
                      )}
                      <span className="sub">
                        Importance {d.importance}
                        {d.recherche && (
                          <>
                            {" · "}
                            <a
                              className="link"
                              href={`https://sketchfab.com/search?q=${encodeURIComponent(d.recherche)}&type=models`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              chercher « {d.recherche} » sur Sketchfab
                            </a>
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                  {!x.manques.length && <p className="notice">Rien d&apos;important ne manque.</p>}
                </div>
                {x.alertes.length > 0 && (
                  <>
                    <h4>Problèmes du rendu Meshy</h4>
                    <ul className="admin-list">{x.alertes.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  </>
                )}
              </>
            )}
            {meshy?.glb && (
              <div className="admin-actions">
                <button className="cta ghost" disabled={Boolean(busy) || detailsBusy} onClick={checkDetails}>
                  {busy === "details" ? "Contrôle…" : details ? "Refaire le contrôle" : "Lancer le contrôle"}
                </button>
              </div>
            )}
          </>
        )}

        {sel === "logos" && (
          <>
            {badges.length > 0 && (
              <>
                <h4>Badges repérés par Claude</h4>
                <ul className="admin-list">
                  {badges.map((b, i) => (
                    <li key={i}>
                      <b>{b.detail}</b> : {b.ou}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {lib && !fichiers.logos ? (
              <>
                <p className="notice">
                  <b>Ajoutés tout seuls depuis la bibliothèque :</b> {lib.label}. Faits par Claude dans Blender, aux bonnes couleurs (chromé en gris
                  clair mat). Les logos de marque ne sont pas copiés : le monogramme JM les remplace. Claude les pose à l&apos;assemblage, autant de fois
                  que nécessaire (ex. le « S » de calandre et celui des clignotants).
                </p>
                <div className="meshy-io">
                  <div className="meshy-col">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="meshy-thumb" src={photoSrc(lib.image)} alt="Badges" />
                  </div>
                  <span className="meshy-arrow" aria-hidden>→</span>
                  <div className="meshy-col">
                    <GlbViewer src={lib.glb} colors />
                    <p className="sub">
                      <a className="link" href={lib.glb} download>Télécharger les badges (.glb)</a>
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p className="notice">
                Pas de badges en bibliothèque pour cette voiture : Claude prépare l&apos;image dans le chat du projet (badges en relief, bonnes couleurs,
                sans copier les logos de marque). Dépose-la ici.
              </p>
            )}
            {fichiers.logos && (
              <a href={photoSrc(fichiers.logos)} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="meshy-thumb" src={photoSrc(fichiers.logos)} alt="Image des logos" />
              </a>
            )}
            <div className="admin-actions">
              <label className={`cta ghost ${busy ? "off" : ""}`}>
                {busy === "logos" ? "Envoi…" : fichiers.logos || lib ? "Remplacer par une autre image" : "Déposer l'image des logos"}
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={Boolean(busy)} onChange={(e) => pick(e, "logos")} />
              </label>
            </div>
          </>
        )}

        {sel === "assemblage" && (
          <>
            <p className="notice">
              <b>L&apos;assemblage se fait dans le chat du projet</b> (Vercel ne fait pas tourner Blender). Envoie à Claude les fichiers ci-dessous : il pose les
              logos, met les couleurs, passe les vitres en noir teinté pour qu&apos;on ne voie pas l&apos;intérieur, et te rend la miniature en .glb.
            </p>
            <ul className="admin-list">
              <li>
                Voiture :{" "}
                {meshy?.glb ? (
                  <a className="link" href={photoSrc(meshy.glb)} download={`meshy-${id}.glb`}>modèle Meshy</a>
                ) : (
                  "pas encore de modèle Meshy (bloc Pièces 3D)"
                )}
              </li>
              <li>
                Badges :{" "}
                {lib ? (
                  <a className="link" href={lib.glb} download>badges 3D de la bibliothèque</a>
                ) : meshyLogos?.glb ? (
                  <a className="link" href={photoSrc(meshyLogos.glb)} download={`logos-${id}.glb`}>logos Meshy</a>
                ) : fichiers.logos ? (
                  <a className="link" href={photoSrc(fichiers.logos)} target="_blank" rel="noreferrer">image des logos</a>
                ) : (
                  "pas encore faits (bloc Logos)"
                )}
              </li>
              {meshySplit?.glb && (
                <li>
                  Voiture découpée :{" "}
                  <a className="link" href={photoSrc(meshySplit.glb)} download={`pieces-${id}.glb`}>
                    {meshySplit.parts ? `${meshySplit.parts} pièces` : "modèle découpé"}
                  </a>
                </li>
              )}
              {x && <li>Liste des détails : bloc Détails manquants</li>}
            </ul>
            {fichiers.final ? (
              <>
                <h4>Miniature terminée</h4>
                <GlbViewer src={photoSrc(fichiers.final)} colors />
                <p className="sub">
                  Regarde-la sous tous les angles avant de l&apos;envoyer au client.{" "}
                  <a className="link" href={photoSrc(fichiers.final)} download={`miniature-${id}.glb`}>Télécharger</a>
                </p>
              </>
            ) : null}
            <div className="admin-actions">
              <label className={`cta ${busy ? "off" : ""}`}>
                {busy === "final" ? "Envoi…" : fichiers.final ? "Remplacer la miniature" : "Déposer la miniature (.glb)"}
                <input type="file" accept=".glb,model/gltf-binary" hidden disabled={Boolean(busy)} onChange={(e) => pick(e, "final")} />
              </label>
            </div>
          </>
        )}

        {def.manual && (
          <div className="admin-actions">
            {suivi[def.manual] ? (
              <>
                <span className="node-ok">Fait le {day(suivi[def.manual])}</span>
                <button className="link" disabled={Boolean(busy)} onClick={() => call(sel, "/api/admin/suivi", { id, step: def.manual, done: false })}>
                  Annuler
                </button>
              </>
            ) : (
              <button className="cta" disabled={Boolean(busy)} onClick={() => call(sel, "/api/admin/suivi", { id, step: def.manual, done: true })}>
                {busy === sel ? "…" : "C'est fait"}
              </button>
            )}
          </div>
        )}
        {error && <p className="notice err">{error}</p>}
      </div>
    </section>
  );
}
