"use client";

import PlatePreview from "./PlatePreview";
import { cleanDep, cleanTexte, PLAQUES, PLAQUE_STYLES, type Plaque } from "@/lib/plaques";

/** Étape « Ta plaque » : le style, le texte, et l'aperçu qui suit en direct. */
export default function PlatePicker({ value, onChange }: { value: Plaque; onChange: (p: Plaque) => void }) {
  const def = PLAQUES[value.style];
  return (
    <div className="plate-pick">
      <PlatePreview plaque={value} className={`plate-svg ${def.format}`} />

      <div className="chips" role="radiogroup" aria-label="Style de plaque">
        {PLAQUE_STYLES.map((s) => (
          <button
            key={s}
            role="radio"
            aria-checked={value.style === s}
            className={`chip ${value.style === s ? "on" : ""}`}
            onClick={() => onChange({ ...value, style: s })}
          >
            {PLAQUES[s].label} <em>{PLAQUES[s].hint}</em>
          </button>
        ))}
      </div>

      {value.style !== "aucune" && (
        <div className="up-fields plate-fields">
          <label>
            Ce qui est écrit dessus
            <input
              placeholder={def.exemple}
              value={cleanTexte(value.texte ?? "", value.style)}
              maxLength={def.max}
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) => onChange({ ...value, texte: cleanTexte(e.target.value, value.style) })}
            />
            <small>
              Ta vraie plaque ou ce que tu veux (prénom, date…) : {def.max} caractères au plus, lettres, chiffres, espaces et tirets.
            </small>
          </label>
          {value.style === "fr" && (
            <label className="plate-dep">
              Département
              <input inputMode="numeric" placeholder="75" value={value.dep ?? ""} maxLength={3} onChange={(e) => onChange({ ...value, dep: cleanDep(e.target.value) })} />
            </label>
          )}
        </div>
      )}
      <p className="wz-tip plate-note">
        La même plaque est posée à l'avant et à l'arrière, en relief. En 1:43 elle fait à peine plus d'un centimètre : elle reste lisible mais toute petite.
      </p>
    </div>
  );
}
