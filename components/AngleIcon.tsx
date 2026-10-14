/** Vue de dessus de la voiture (avant en haut) avec la position de l'appareil photo. */
const CAMERA: Record<string, [number, number, number]> = {
  avant: [40, 6, 180],
  arriere: [40, 74, 0],
  gauche: [6, 40, 90],
  droite: [74, 40, -90],
};

export default function AngleIcon({ angle }: { angle: keyof typeof CAMERA | string }) {
  const cam = CAMERA[angle];
  return (
    <svg viewBox="0 0 80 80" className="angle-icon" aria-hidden>
      <rect x="27" y="18" width="26" height="44" rx="9" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" />
      <path d="M31,30 Q40,25 49,30" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" />
      <path d="M31,52 Q40,56 49,52" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      {cam ? (
        <g transform={`translate(${cam[0]} ${cam[1]}) rotate(${cam[2]})`}>
          <path d="M0,0 L-9,-14 L9,-14 Z" fill="currentColor" opacity="0.35" transform="rotate(180)" />
          <circle r="4.5" fill="currentColor" />
        </g>
      ) : (
        <text x="40" y="45" textAnchor="middle" fontSize="16" fill="currentColor">+</text>
      )}
    </svg>
  );
}
