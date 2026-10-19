"use client";

import { useEffect, useState } from "react";
import type { SketchfabHit } from "@/lib/sketchfab";
import { DEFAULT_ADJUST, type PartAdjust } from "./partFit";

export type Part = {
  uid: string;
  name: string;
  author: string;
  authorUrl?: string;
  licence: string;
  viewerUrl: string;
  url: string;
  zip?: boolean;
  adjust: PartAdjust;
};

const TEXT = {
  rim: { placeholder: "Cherche une jante : BBS, TE37, Rotiform…", noun: "jante" },
  exhaust: { placeholder: "Cherche un échappement : Akrapovic, embout carbone…", noun: "sortie" },
};

/** Recherche d'une pièce sur Sketchfab, puis réglages si la pose automatique n'est pas parfaite. */
export default function PartSearch({
  kind,
  part,
  status,
  onChange,
}: {
  kind: "rim" | "exhaust";
  part: Part | null;
  status: string;
  onChange: (p: Part | null) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SketchfabHit[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [picking, setPicking] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      setState("idle");
      return;
    }
    setState("loading");
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/sketchfab/search?kind=${kind}&q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: { results?: SketchfabHit[]; error?: string }) => {
          if (d.error) throw new Error(d.error);
          setHits(d.results ?? []);
          setState("idle");
        })
        .catch((e: Error) => e.name !== "AbortError" && setState("error"));
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, kind]);

  async function choose(h: SketchfabHit) {
    setPicking(h.uid);
    setErr("");
    try {
      const res = await fetch(`/api/sketchfab/model/${encodeURIComponent(h.uid)}`);
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error ?? `erreur ${res.status}`);
      onChange({ ...d, url: d.file.url, zip: d.file.zip, adjust: DEFAULT_ADJUST });
      setHits([]);
      setQ("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPicking("");
    }
  }

  const adjust = (a: Partial<PartAdjust>) => part && onChange({ ...part, adjust: { ...part.adjust, ...a } });

  return (
    <div className="part">
      {part && (
        <div className="part-chosen">
          <p className="sub">
            <strong>{part.name}</strong> par {part.author}
            {status === "loading" && " · pose en cours…"}
          </p>
          {status && status !== "loading" && <p className="notice err">La pose automatique a échoué : {status}.</p>}
          <div className="chips">
            <button className="chip" onClick={() => adjust({ flip: !part.adjust.flip })}>Retourner</button>
            <button className="chip" onClick={() => adjust({ turn: (part.adjust.turn + 1) % 3 })}>Tourner</button>
            <button className="chip" onClick={() => adjust({ scale: Math.max(0.6, +(part.adjust.scale - 0.05).toFixed(2)) })}>Plus petit</button>
            <button className="chip" onClick={() => adjust({ scale: Math.min(1.6, +(part.adjust.scale + 0.05).toFixed(2)) })}>Plus grand</button>
            <button className="chip" onClick={() => onChange(null)}>Retirer</button>
          </div>
        </div>
      )}
      <input
        type="search"
        className="search-input small"
        placeholder={TEXT[kind].placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />
      {state === "loading" && <p className="sub">Recherche…</p>}
      {state === "error" && <p className="sub">Pas de résultat pour l'instant. Garde la pièce d'origine, ou réessaie un peu plus tard.</p>}
      {state === "idle" && q.trim().length >= 2 && hits.length === 0 && <p className="sub">Aucune {TEXT[kind].noun} trouvée.</p>}
      {err && <p className="notice err">{err}</p>}
      {hits.length > 0 && (
        <div className="part-grid">
          {hits.map((h) => (
            <button key={h.uid} className="part-card" onClick={() => choose(h)} disabled={!!picking}>
              {h.thumb ? <img src={h.thumb} alt="" loading="lazy" /> : <div className="noimg" />}
              <span>{picking === h.uid ? "Téléchargement…" : h.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
