"use client";

import PlatePreview from "./PlatePreview";
import { cleanDep, cleanTexte, couleursPlaque, MAX_TEXTE, PLAQUES, PLAQUE_STYLES, TEINTES, type Couleurs, type Plaque } from "@/lib/plaques";

/** Une ligne de couleur : quelques teintes en un clic, le sélecteur libre pour toutes les autres, et le retour à l'origine. */
function Teinte({ label, value, origine, onChange }: { label: string; value: string; origine: string; onChange: (v: string | undefined) => void }) {
  return (
    <div className="plate-color">
      <span>{label}</span>
      <div className="plate-swatches">
        {TEINTES.map((h) => (
          <button key={h} type="button" className={`swatch ${value === h ? "on" : ""}`} style={{ background: h }} aria-label={`${label} ${h}`} aria-pressed={value === h} onClick={() => onChange(h === origine ? undefined : h)} />
        ))}
        <label className="swatch libre" title="Une autre couleur">
          <input type="color" value={value} aria-label={`${label} : autre couleur`} onChange={(e) => onChange(e.target.value === origine ? undefined : e.target.value)} />
        </label>
        {value !== origine && (
          <button type="button" className="link" onClick={() => onChange(undefined)}>
            Remettre d'origine
          </button>
        )}
      </div>
    </div>
  );
}

/** Étape « Ta plaque » : on voit toutes les plaques, on en choisit une, puis on écrit et on colore en voyant le résultat. */
export default function PlatePicker({ value, onChange }: { value: Plaque; onChange: (p: Plaque) => void }) {
  const def = PLAQUES[value.style];
  const c = couleursPlaque(value);
  const setCouleur = (k: keyof Couleurs, v: string | undefined) => {
    const couleurs = { ...value.couleurs, [k]: v };
    if (!v) delete couleurs[k];
    onChange({ ...value, couleurs: Object.keys(couleurs).length ? couleurs : undefined });
  };

  return (
    <div className="plate-pick">
      <h3 className="plate-h">1. Choisis ta plaque</h3>
      <div className="plate-cards" role="radiogroup" aria-label="Style de plaque">
        {PLAQUE_STYLES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value.style === s}
            className={`plate-card ${value.style === s ? "on" : ""}`}
            // Les couleurs dépendent du style : on repart de celles d'origine, le texte et le département restent.
            onClick={() => onChange({ style: s, texte: value.texte, dep: value.dep })}
          >
            <PlatePreview plaque={{ style: s, texte: value.texte, dep: value.dep }} className={`plate-svg card ${PLAQUES[s].format}`} />
            <strong>{PLAQUES[s].label}</strong>
            <em>{PLAQUES[s].hint}</em>
          </button>
        ))}
      </div>

      {value.style !== "aucune" && (
        <>
          <h3 className="plate-h">2. Écris ce que tu veux</h3>
          <div className="plate-stage">
            <PlatePreview plaque={value} className={`plate-svg ${def.format}`} />
          </div>
          <div className="up-fields plate-fields">
            <label>
              Texte de la plaque
              <input
                placeholder={def.exemple}
                value={value.texte ?? ""}
                maxLength={MAX_TEXTE}
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(e) => onChange({ ...value, texte: cleanTexte(e.target.value, "aucune") })}
              />
              <small>
                Ta vraie plaque, ton prénom, 2 lettres… comme tu veux : de 1 à {def.max} caractères (lettres, chiffres, espaces, tirets).
                {(value.texte ?? "").trim().length > def.max && ` Ici seuls les ${def.max} premiers tiennent sur la plaque.`}
              </small>
            </label>
            {value.style === "fr" && (
              <label className="plate-dep">
                Département
                <input inputMode="numeric" placeholder="75" value={value.dep ?? ""} maxLength={3} onChange={(e) => onChange({ ...value, dep: cleanDep(e.target.value) })} />
              </label>
            )}
          </div>

          <h3 className="plate-h">3. Les couleurs</h3>
          <div className="plate-colors">
            <Teinte label="Fond" value={c.fond} origine={def.couleurs.fond} onChange={(v) => setCouleur("fond", v)} />
            <Teinte label="Lettres" value={c.texte} origine={def.couleurs.texte} onChange={(v) => setCouleur("texte", v)} />
            {c.bande && def.couleurs.bande && <Teinte label="Bandes" value={c.bande} origine={def.couleurs.bande} onChange={(v) => setCouleur("bande", v)} />}
          </div>
        </>
      )}
      <p className="wz-tip plate-note">
        La même plaque est posée à l'avant et à l'arrière, en relief. En 1:43 elle fait à peine plus d'un centimètre : elle reste lisible mais toute petite.
      </p>
    </div>
  );
}
