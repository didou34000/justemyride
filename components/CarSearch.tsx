"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SketchfabHit } from "@/lib/sketchfab";

/**
 * Barre de recherche dans les modèles 3D Sketchfab (seulement ceux qu'on a le droit de vendre).
 * Avec onPick, un clic choisit le modèle au lieu d'ouvrir le configurateur.
 */
export default function CarSearch({ initial = "", onPick }: { initial?: string; onPick?: (h: SketchfabHit) => void }) {
  const [q, setQ] = useState(initial);
  const [hits, setHits] = useState<SketchfabHit[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

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
      fetch(`/api/sketchfab/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
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
  }, [q]);

  return (
    <div className="search">
      <input
        type="search"
        className="search-input"
        placeholder="Tape ta voiture : golf gti, clio rs, 911…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />
      <p className="search-note">
        {state === "loading"
          ? "Recherche…"
          : state === "error"
            ? "La recherche est indisponible pour l'instant. Pas grave : envoie tes photos, on retrouve le modèle nous-mêmes."
            : q.trim().length >= 2 && hits.length === 0
              ? "Aucun modèle trouvé. Essaie avec la marque et le modèle seulement."
              : "Modèles 3D fournis par Sketchfab. Tu choisis seulement la forme de base : couleurs et pièces se règlent après."}
      </p>
      {hits.length > 0 && (
        <div className="garage-grid results">
          {hits.map((h) => {
            const body = (
              <>
                {h.thumb ? <img src={h.thumb} alt="" loading="lazy" /> : <div className="noimg" />}
                <div className="car-card-body">
                  <strong>{h.name}</strong>
                  <span>
                    par {h.author}
                    {h.sizeMb ? ` · ${h.sizeMb} Mo` : ""}
                  </span>
                </div>
              </>
            );
            return onPick ? (
              <button key={h.uid} type="button" className="car-card pick" onClick={() => onPick(h)}>
                {body}
              </button>
            ) : (
              <Link key={h.uid} href={`/configurer/sketchfab/${h.uid}`} className="car-card">
                {body}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
