import type { Config } from "@/lib/options";
import { wheelColors } from "@/lib/options";

/** Aperçu 2D en attendant le viewer 3D. Profil de coupé générique. */
export default function CarPreview({ config }: { config: Config }) {
  const rim = wheelColors.find((w) => w.id === config.wheelColor)?.hex ?? "#c9ccd1";
  const gloss = config.finish === "brillant" ? 0.55 : config.finish === "metal" ? 0.35 : 0;

  return (
    <svg viewBox="0 0 800 300" className="car" role="img" aria-label="Aperçu de la voiture">
      <defs>
        <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={gloss} />
          <stop offset="0.45" stopColor="#fff" stopOpacity={gloss * 0.15} />
          <stop offset="1" stopColor="#000" stopOpacity={0.35} />
        </linearGradient>
        {config.finish === "metal" && (
          <filter id="flake">
            <feTurbulence type="fractalNoise" baseFrequency="1.8" numOctaves="1" result="n" />
            <feColorMatrix in="n" type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.12" />
            </feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
        )}
        <radialGradient id="shadow">
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="400" cy="262" rx="360" ry="22" fill="url(#shadow)" />

      {config.spoiler === "gt" && (
        <g fill="#141518">
          <rect x="96" y="112" width="8" height="34" />
          <rect x="140" y="114" width="8" height="30" />
          <path d="M62,106 L178,100 L180,112 L66,118 Z" />
        </g>
      )}

      <path id="body" d={BODY} fill={config.color} />
      {config.finish === "metal" && <path d={BODY} filter="url(#flake)" fill="#fff" />}
      <path d={BODY} fill="url(#shine)" />
      <path d={BODY} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="1.5" />

      {config.spoiler === "lip" && <path d="M64,150 L120,146 L118,152 L64,155 Z" fill="#141518" />}

      {/* vitrage */}
      <path d="M248,140 Q292,104 350,97 L458,95 Q516,98 560,134 L556,140 Z" fill="#0b0c0e" />
      <path d="M262,136 Q300,108 352,102 L400,101 L398,136 Z" fill="#fff" opacity="0.06" />
      <rect x="400" y="96" width="9" height="44" fill={config.color} />

      {/* lignes */}
      <path d="M150,168 L700,160" stroke="#000" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M412,145 L414,200" stroke="#000" strokeOpacity="0.3" strokeWidth="1.5" />
      <rect x="455" y="150" width="22" height="4" rx="2" fill="#000" opacity="0.35" />

      {/* feux */}
      <path d="M708,150 Q730,152 738,166 L712,164 Z" fill="#f4f6f8" />
      <path d="M62,160 L84,158 L84,172 L61,174 Z" fill="#c21420" />

      <Wheel cx={205} rim={rim} style={config.wheelStyle} />
      <Wheel cx={600} rim={rim} style={config.wheelStyle} />
    </svg>
  );
}

const BODY =
  "M58,200 L58,176 Q60,158 92,150 L212,140 Q272,98 344,88 L468,85 Q540,88 600,128 L700,140 Q738,146 742,172 L744,200 Q744,212 732,212 L662,212 A62,62 0 0 0 538,212 L267,212 A62,62 0 0 0 143,212 L70,212 Q58,212 58,200 Z";

function Wheel({ cx, rim, style }: { cx: number; rim: string; style: string }) {
  const cy = 212;
  const spokes = style === "cinq" ? 5 : style === "multi" ? 10 : 0;
  return (
    <g>
      <circle cx={cx} cy={cy} r="52" fill="#0c0d0f" />
      <circle cx={cx} cy={cy} r="37" fill="#26282c" />
      {style === "turbine" ? (
        <>
          <circle cx={cx} cy={cy} r="35" fill={rim} />
          {Array.from({ length: 14 }).map((_, i) => (
            <path
              key={i}
              d={`M${cx},${cy} q12,-14 0,-34`}
              stroke="#000"
              strokeOpacity="0.35"
              strokeWidth="2"
              fill="none"
              transform={`rotate(${(360 / 14) * i} ${cx} ${cy})`}
            />
          ))}
        </>
      ) : (
        <>
          <circle cx={cx} cy={cy} r="35" fill="none" stroke={rim} strokeWidth="4" />
          {Array.from({ length: spokes }).map((_, i) => (
            <rect
              key={i}
              x={cx - (spokes === 5 ? 4 : 2)}
              y={cy - 34}
              width={spokes === 5 ? 8 : 4}
              height="30"
              rx="2"
              fill={rim}
              transform={`rotate(${(360 / spokes) * i} ${cx} ${cy})`}
            />
          ))}
        </>
      )}
      <circle cx={cx} cy={cy} r="7" fill={rim} stroke="#000" strokeOpacity="0.4" />
    </g>
  );
}
