"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flow, StepIcon } from "./Flow";
import { photoSrc } from "@/lib/photo";
import LiveRefresh from "./LiveRefresh";
import GlbViewer from "./GlbViewer";
import { MESHY_VIEWS, STEPS } from "@/lib/steps";
import type { Order } from "@/lib/orders";

const TRAITEMENT: Record<string, string> = {
  couleur: "Peinture",
  decalque: "Décalque",
  piece_3d: "Pièce 3D",
  a_verifier: "À vérifier",
};

const day = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";

/** Page du propriétaire pour une demande : le circuit en blocs, et le détail du bloc choisi. */
export default function AdminDemande({ order }: { order: Order }) {
  const router = useRouter();
  const { id, demande, analyse, meshy, suivi, steps } = order;
  const first = steps.find((s) => s.state === "error" || s.state === "current")?.key ?? "photos";
  const [sel, setSel] = useState(first);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const r = analyse?.result;
  const step = steps.find((s) => s.key === sel)!;
  const def = STEPS.find((s) => s.key === sel)!;
  const meshyRunning = Boolean(meshy && !meshy.glb && meshy.taskId && !["SUCCEEDED", "FAILED", "CANCELED", "error"].includes(meshy.status));
  const analyseBusy = Boolean(steps.find((s) => s.key === "analyse")?.busy);
  const running = analyseBusy || meshyRunning;

  const pieces = r?.differences.filter((d) => d.traitement === "piece_3d") ?? [];
  const meshyInputs =
    meshy?.inputs ??
    (MESHY_VIEWS.map((v) => demande.files.find((f) => f.slot === v)?.pathname).filter(Boolean) as string[]);

  // Générations finies avant qu'on garde l'aperçu : on va le chercher une fois chez Meshy.
  const needThumb = Boolean(meshy?.glb && !meshy.thumb && meshy.taskId);
  useEffect(() => {
    if (needThumb) fetch(`/api/meshy?id=${id}`).then(() => router.refresh()).catch(() => null);
  }, [needThumb, id, router]);

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
        <LiveRefresh every={running ? 8 : 30} poll={meshyRunning ? `/api/meshy?id=${id}` : undefined} />
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

            <div className="admin-actions">
              <button
                className="cta ghost"
                disabled={Boolean(busy) || Boolean(meshy)}
                onClick={() => call("meshy", "/api/meshy", { id }, "Lancer une génération Meshy payante à partir des 4 faces de la voiture ?")}
              >
                {meshy ? "Génération lancée" : busy === "meshy" ? "Lancement…" : "Générer en 3D (Meshy)"}
              </button>
            </div>
          </>
        )}

        {sel === "assemblage" && (
          <div className="notice">
            <b>Rien ne se fait tout seul ici pour l&apos;instant.</b> Le site tourne sur Vercel, qui ne peut pas faire tourner Blender. L&apos;assemblage
            (pose des pièces sur la base, couleurs, décalques) se fait à la main : Claude le fait dans Blender, dans le chat du projet.{" "}
            {meshy?.glb ? (
              <>
                Télécharge{" "}
                <a className="link" href={photoSrc(meshy.glb)} download={`meshy-${id}.glb`}>le modèle Meshy</a>
                {demande.base?.uid && (
                  <>
                    {" "}et{" "}
                    <a className="link" href={`https://sketchfab.com/3d-models/${demande.base.uid}`} target="_blank" rel="noreferrer">
                      le modèle de base
                    </a>
                  </>
                )}
                , envoie-{demande.base?.uid ? "les" : "le"} dans le chat, puis coche « C&apos;est fait » quand le rendu est prêt.
              </>
            ) : (
              "Il faut d'abord le modèle Meshy (bloc Pièces 3D)."
            )}
          </div>
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
