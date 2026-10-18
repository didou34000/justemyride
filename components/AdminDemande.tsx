"use client";

import { useCallback, useEffect, useState } from "react";
import type { AnalysisRecord } from "@/lib/analyse";
import type { Base } from "@/lib/catalog";

type Data = {
  demande: { email: string; car: string; base?: Base | null; receivedAt?: string; files: { slot: string }[] };
  analyse: AnalysisRecord | null;
  usage: { today: number; month: number; dailyLimit: number; monthlyLimit: number };
};

const TRAITEMENT: Record<string, string> = {
  couleur: "Peinture",
  decalque: "Décalque",
  piece_3d: "Pièce 3D",
  a_verifier: "À vérifier",
};

/** Page du propriétaire : la demande d'un client et le point de l'analyse automatique. Protégée par ADMIN_TOKEN. */
export default function AdminDemande({ id }: { id: string }) {
  const [token, setToken] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setToken(localStorage.getItem("jmr-admin") ?? "");
    } catch {}
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setError("");
    const res = await fetch(`/api/analyse?id=${encodeURIComponent(id)}`, { headers: { "x-admin-token": token } });
    const d = await res.json();
    if (!res.ok) return setError(d.error ?? `Erreur ${res.status}`);
    try {
      localStorage.setItem("jmr-admin", token);
    } catch {}
    setData(d);
  }, [id, token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  // Tant que l'analyse tourne, on recharge de temps en temps.
  useEffect(() => {
    if (data?.analyse?.status !== "running") return;
    const t = setTimeout(load, 8000);
    return () => clearTimeout(t);
  }, [data, load]);

  async function rerun(force: boolean) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/analyse", {
      method: "POST",
      headers: { "x-admin-token": token, "Content-Type": "application/json" },
      body: JSON.stringify({ id, force }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setError(d.error ?? `Erreur ${res.status}`);
    load();
  }

  if (!data)
    return (
      <section className="admin">
        <h2>Demande {id}</h2>
        <form
          className="up-fields"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <input type="password" placeholder="Code admin" value={token} onChange={(e) => setToken(e.target.value)} />
          <button className="cta">Ouvrir</button>
        </form>
        {error && <p className="notice err">{error}</p>}
      </section>
    );

  const { demande, analyse, usage } = data;
  const r = analyse?.result;
  return (
    <section className="admin">
      <p className="eyebrow">Demande {id}</p>
      <h2>{demande.car || demande.base?.label || "Voiture"}</h2>
      <p className="sub">
        {demande.email} · {demande.files.length} photos
        {demande.base?.uid && (
          <>
            {" · "}
            <a className="link" href={`https://sketchfab.com/3d-models/${demande.base.uid}`} target="_blank" rel="noreferrer">
              modèle de base
            </a>
          </>
        )}
      </p>

      {!analyse && <p className="notice">Pas encore analysée.</p>}
      {analyse?.status === "running" && <p className="notice">Analyse en cours…</p>}
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
                <span className="sub">
                  Confiance {d.confiance} · photos : {d.photos.join(", ") || "?"}
                </span>
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

      <div className="admin-actions">
        <button className="cta ghost" disabled={busy || analyse?.status === "running"} onClick={() => rerun(Boolean(analyse))}>
          {busy ? "Analyse…" : analyse ? "Refaire l'analyse" : "Lancer l'analyse"}
        </button>
        <span className="sub">
          Analyses : {usage.today}/{usage.dailyLimit} aujourd&apos;hui, {usage.month}/{usage.monthlyLimit} ce mois-ci
        </span>
      </div>
      {error && <p className="notice err">{error}</p>}
    </section>
  );
}
