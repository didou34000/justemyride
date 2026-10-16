"use client";

import { useState } from "react";

/** Comparateur : l'image de gauche se dévoile en glissant le curseur. */
export default function BeforeAfter({
  before,
  after,
  beforeLabel,
  afterLabel,
}: {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
}) {
  const [x, setX] = useState(50);
  return (
    <div className="ba" style={{ "--x": `${x}%` } as React.CSSProperties}>
      <img src={before} alt={beforeLabel} />
      <img className="ba-after" src={after} alt={afterLabel} />
      <div className="ba-bar">
        <span className="ba-knob" aria-hidden>
          ⇆
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={x}
        onChange={(e) => setX(Number(e.target.value))}
        aria-label="Comparer avant et après"
      />
      <span className="ba-label l">{beforeLabel}</span>
      <span className="ba-label r">{afterLabel}</span>
    </div>
  );
}
