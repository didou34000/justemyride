"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Timeline from "./Timeline";
import { STEPS } from "@/lib/steps";
import type { Order } from "@/lib/orders";

const TRAITEMENT: Record<string, string> = {
  couleur: "Peinture",
  decalque: "Décalque",
  piece_3d: "Pièce 3D",
  a_verifier: "À vérifier",
};

/** Page du propriétaire pour une demande : frise, photos, le point de l'analyse, actions. */
export default function AdminDemande({ order }: { order: Order }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const { id, demande, analyse, meshy, suivi, steps } = order;
  const r = analyse?.result;

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
    <section className="admin">
      <p className="eyebrow">Demande {id}</p>
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

      <h3>Chronologie</h3>
      <Timeline steps={steps} />
      <div className="frise-actions">
        {STEPS.filter((s) => s.manual).map((s) => {
          const done = Boolean(suivi[s.manual!]);
          return (
            <button
              key={s.key}
              className={`chip ${done ? "on" : ""}`}
              disabled={Boolean(busy)}
              onClick={() => call(s.key, "/api/admin/suivi", { id, step: s.manual, done: !done })}
            >
              {done ? "✓ " : ""}
              {s.label}
            </button>
          );
        })}
      </div>

      <h3>Photos</h3>
      <div className="admin-photos">
        {demande.files.map((f) => (
          <a key={f.pathname} href={`/api/admin/photo?p=${encodeURIComponent(f.pathname)}`} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/admin/photo?p=${encodeURIComponent(f.pathname)}`} alt={f.slot} loading="lazy" />
            <span>{f.slot}</span>
          </a>
        ))}
      </div>

      <h3>Le point</h3>
      {!analyse && <p className="notice">Pas encore analysée.</p>}
      {analyse?.status === "running" && <p className="notice">Analyse en cours… recharge la page dans un moment.</p>}
      {analyse?.status === "error" && <p className="notice err">Analyse impossible : {analyse.error}</p>}
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
              <h3>Photos à demander</h3>
              <ul className="admin-list">{r.photos_a_demander.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </>
          )}
          {r.alertes.length > 0 && (
            <>
              <h3>Alertes</h3>
              <ul className="admin-list">{r.alertes.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </>
          )}
        </>
      )}

      <h3>Actions</h3>
      <div className="admin-actions">
        <button
          className="cta ghost"
          disabled={Boolean(busy) || analyse?.status === "running"}
          onClick={() => call("analyse", "/api/analyse", { id, force: Boolean(analyse) })}
        >
          {busy === "analyse" ? "Analyse…" : analyse ? "Refaire l'analyse" : "Lancer l'analyse"}
        </button>
        <button
          className="cta ghost"
          disabled={Boolean(busy) || Boolean(meshy)}
          onClick={() =>
            call("meshy", "/api/meshy", { id }, "Lancer une génération Meshy payante à partir des 4 faces de la voiture ?")
          }
        >
          {meshy ? `Meshy : ${meshy.status}${meshy.progress ? ` ${meshy.progress} %` : ""}` : busy === "meshy" ? "Lancement…" : "Générer en 3D (Meshy)"}
        </button>
        {meshy && !meshy.glb && meshy.taskId && (
          <button className="link" disabled={Boolean(busy)} onClick={async () => { await fetch(`/api/meshy?id=${id}`); router.refresh(); }}>
            Actualiser Meshy
          </button>
        )}
      </div>
      {error && <p className="notice err">{error}</p>}
    </section>
  );
}
