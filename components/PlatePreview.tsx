import { couleursPlaque, PLAQUES, texteAffiche, type Plaque } from "@/lib/plaques";

/*
 * Aperçu d'une plaque, dessiné en SVG aux vraies proportions (520 × 110 mm en Europe, 305 × 152 mm aux USA).
 * Les couleurs (celles du style ou celles choisies par le client) sont les mêmes que sur la plaque 3D (tools/plaque.py).
 */
const JAUNE_UE = "#ffcc00";
const CHAR = '"Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif';

/**
 * Texte centré à largeur imposée : serré comme les caractères des vraies plaques (`serre` × hauteur par caractère),
 * et jamais plus large que la place. La largeur ne dépend donc pas de la police dispo sur le téléphone.
 */
function Fit({ t, x, y, w, size, fill, family = CHAR, weight = 700, style, serre = 0.52 }: { t: string; x: number; y: number; w: number; size: number; fill: string; family?: string; weight?: number; style?: string; serre?: number }) {
  const width = Math.min(w, t.length * size * serre);
  return (
    <text x={x} y={y} fontSize={size} fill={fill} fontFamily={family} fontWeight={weight} fontStyle={style} textAnchor="middle" dominantBaseline="central" textLength={width} lengthAdjust="spacingAndGlyphs">
      {t}
    </text>
  );
}

function EuroBand({ x, letter, bleu }: { x: number; letter: string; bleu: string }) {
  return (
    <g>
      <rect x={x} y={6} width={42} height={98} rx={3} fill={bleu} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        return <circle key={i} cx={x + 21 + 12 * Math.cos(a)} cy={34 + 12 * Math.sin(a)} r={2.4} fill={JAUNE_UE} />;
      })}
      <Fit t={letter} x={x + 21} y={80} w={34} size={30} fill="#fff" />
    </g>
  );
}

export default function PlatePreview({ plaque, className }: { plaque: Plaque; className?: string }) {
  const def = PLAQUES[plaque.style];
  const t = texteAffiche(plaque);
  const c = couleursPlaque(plaque);
  const label = `Aperçu de la plaque : ${def.label}${t ? `, ${t}` : ""}`;

  if (plaque.style === "aucune") {
    return (
      <svg className={className} viewBox="0 0 520 110" role="img" aria-label={label}>
        <rect x={2} y={2} width={516} height={106} rx={8} fill="none" stroke="currentColor" strokeOpacity={0.3} strokeWidth={3} strokeDasharray="10 8" />
        <text x={260} y={55} fontSize={28} fill="currentColor" fillOpacity={0.5} textAnchor="middle" dominantBaseline="central" fontFamily={CHAR}>
          Pas de plaque
        </text>
      </svg>
    );
  }

  if (def.format === "us") {
    const floride = plaque.style === "floride";
    const ink = c.texte;
    // En Floride, une orange sépare les deux moitiés du numéro.
    const [a, b] = t.includes(" ") ? [t.slice(0, t.indexOf(" ")), t.slice(t.indexOf(" ") + 1)] : [t.slice(0, Math.ceil(t.length / 2)), t.slice(Math.ceil(t.length / 2))];
    return (
      <svg className={className} viewBox="0 0 305 152" role="img" aria-label={label}>
        <rect x={1} y={1} width={303} height={150} rx={12} fill={c.fond} stroke="#9a9a9a" strokeWidth={2} />
        {floride ? (
          <>
            <Fit t="MYFLORIDA.COM" x={152} y={22} w={150} size={17} serre={0.62} fill={ink} />
            <Fit t={a} x={74} y={80} w={100} size={70} fill={ink} />
            <circle cx={152} cy={80} r={20} fill="#f28c1b" />
            <path d="M152 60 q10 -8 18 -2 q-10 6 -18 2z" fill="#2f8a3e" />
            <Fit t={b} x={231} y={80} w={100} size={70} fill={ink} />
            <Fit t="SUNSHINE STATE" x={152} y={133} w={170} size={17} serre={0.62} fill={ink} />
          </>
        ) : (
          <>
            <Fit t="California" x={152} y={28} w={160} size={34} fill="#c8102e" family='"Brush Script MT", "Segoe Script", cursive' weight={400} style="italic" serre={0.45} />
            <Fit t={t} x={152} y={88} w={270} size={74} fill={ink} />
            <Fit t="DMV.CA.GOV" x={152} y={136} w={110} size={14} serre={0.62} fill={ink} />
          </>
        )}
      </svg>
    );
  }

  const { fond, texte: encre } = c;
  const bleu = c.bande ?? "#0b2a8c";
  const gauche = plaque.style === "fr" || plaque.style === "de";
  const droite = plaque.style === "fr";
  const x0 = gauche ? 52 : 14;
  const x1 = droite ? 468 : 506;
  return (
    <svg className={className} viewBox="0 0 520 110" role="img" aria-label={label}>
      <rect x={1} y={1} width={518} height={108} rx={8} fill={fond} stroke="#8a8a8a" strokeWidth={2} />
      <rect x={4} y={4} width={512} height={102} rx={6} fill="none" stroke={encre} strokeWidth={1.5} />
      {gauche && <EuroBand x={6} bleu={bleu} letter={plaque.style === "de" ? "D" : "F"} />}
      {droite && (
        <g>
          <rect x={472} y={6} width={42} height={98} rx={3} fill={bleu} />
          {/* Logo de région simplifié (un vrai logo ferait 2 mm sur la miniature). */}
          <rect x={480} y={20} width={26} height={26} fill="#b3141b" />
          <rect x={485} y={31.5} width={16} height={3} fill={JAUNE_UE} />
          <rect x={491.5} y={25} width={3} height={16} fill={JAUNE_UE} />
          <Fit t={plaque.dep || "··"} x={493} y={80} w={36} size={26} fill="#fff" />
        </g>
      )}
      <Fit t={t} x={(x0 + x1) / 2} y={57} w={x1 - x0 - 12} size={96} fill={encre} />
    </svg>
  );
}
