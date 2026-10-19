"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import LazyShelf from "./LazyShelf";
import { colors, heights, ORIGINE, wheelColors, type Config } from "@/lib/options";
import type { Car } from "@/lib/cars";

/** Sur l'accueil : quelques réglages du configurateur, appliqués en direct à la miniature 3D. */
const PAINTS = ["origine", "noir", "blanc", "nardo", "rouge", "jaune", "vert-anglais", "orange", "violet"];
const RIMS = ["origine", "noir", "bronze", "or", "argent"];

export default function TryIt({ car }: { car: Car }) {
  const [paint, setPaint] = useState(ORIGINE);
  const [rim, setRim] = useState(ORIGINE);
  const [height, setHeight] = useState(ORIGINE);
  const tweak = useMemo<Partial<Config>>(() => {
    const col = colors.find((c) => c.id === paint);
    return { paint: col?.hex ?? ORIGINE, paintName: col?.label ?? "D'origine", rimColor: rim, height };
  }, [paint, rim, height]);
  const paintName = colors.find((c) => c.id === paint)?.label ?? "Couleur d'origine";

  return (
    <div className="try">
      <div className="try-stage">
        <LazyShelf car={car} tweak={tweak} />
      </div>
      <div className="try-panel">
        <h2>Essaie, là, tout de suite.</h2>
        <p>
          C'est la {car.make} {car.model} de notre garage. Change sa couleur, ses jantes, sa hauteur : l'aperçu de ta
          voiture marche exactement pareil.
        </p>
        <div className="try-row">
          <span className="try-label">
            Couleur <b>{paintName}</b>
          </span>
          <div className="swatches">
            {PAINTS.map((id) => {
              const col = colors.find((c) => c.id === id);
              return (
                <button
                  key={id}
                  className={`swatch ${col ? "" : "origin"} ${paint === id ? "on" : ""}`}
                  style={col ? { background: col.hex } : undefined}
                  aria-label={col?.label ?? "Couleur d'origine"}
                  title={col?.label ?? "Couleur d'origine"}
                  onClick={() => setPaint(id)}
                >
                  {col ? null : "↺"}
                </button>
              );
            })}
          </div>
        </div>
        <div className="try-row">
          <span className="try-label">Jantes</span>
          <div className="swatches tight">
            {RIMS.map((id) => {
              const w = wheelColors.find((c) => c.id === id);
              return (
                <button
                  key={id}
                  className={`swatch ${w ? "" : "origin"} ${rim === id ? "on" : ""}`}
                  style={w ? { background: w.hex } : undefined}
                  aria-label={w?.label ?? "Jantes d'origine"}
                  title={w?.label ?? "Jantes d'origine"}
                  onClick={() => setRim(id)}
                >
                  {w ? null : "↺"}
                </button>
              );
            })}
          </div>
        </div>
        <div className="try-row">
          <span className="try-label">Hauteur</span>
          <div className="chips">
            {heights.map((h) => (
              <button key={h.id} className={`chip ${height === h.id ? "on" : ""}`} onClick={() => setHeight(h.id)}>
                {h.label}
              </button>
            ))}
          </div>
        </div>
        <Link href={`/configurer/${car.slug}`} className="cta dark">
          Tout personnaliser
        </Link>
      </div>
    </div>
  );
}
