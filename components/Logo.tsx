/** Petite voiture sur son socle : sert d'illustration (tailles, cases vides). */
export function CarGlyph({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="currentColor" aria-hidden>
      <defs>
        <mask id="jmr-glyph-cut">
          <rect width="28" height="28" fill="#fff" />
          <path d="M10.4 14.2 13.3 11.8h2.4v2.4zM16.7 11.8h2.6l2.3 2.4h-4.9z" fill="#000" />
          <circle cx="8.6" cy="19" r="2.9" fill="#000" />
          <circle cx="19.6" cy="19" r="2.9" fill="#000" />
        </mask>
      </defs>
      <path
        mask="url(#jmr-glyph-cut)"
        d="M3.6 19v-2.6q0-1.2 1.2-1.5l4.4-1.1 3.4-2.9q.6-.5 1.4-.5h5.6q.9 0 1.4.6l2.5 3q.9.4.9 1.4V19z"
      />
      <circle cx="8.6" cy="19" r="2" />
      <circle cx="19.6" cy="19" r="2" />
      <rect x="2" y="22.4" width="24" height="3.4" rx="1.7" />
    </svg>
  );
}

/** Le signe JustMyRide : une voiture rouge dans sa vitrine, sur son socle marine. */
export function LogoMark({ size = 54 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 44) / 68} viewBox="0 0 68 44" aria-hidden className="logo-mark">
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M4 36V8h54v28M4 8l5-5h54v28l-5 5M58 8l5-5" />
        <path d="M9 14.5l4-4M9 18l2-2M52 12.5l3-3" strokeWidth="1.1" opacity=".55" />
      </g>
      <path
        d="M10.5 33v-3.4q0-1.6 1.6-2l7-1.9 5.4-4.6q1.4-1.2 3.4-1.2H43l3.2-.5.4 1.6-1.5.5 3.5 4.3q1.6.5 1.6 2.2V33z"
        fill="var(--red, #d7263d)"
      />
      <path d="M21.6 25.5l4.1-3.6q.6-.5 1.4-.5h4.6v4.1zM33.2 21.4h8.9l3.3 4.1H33.2z" fill="var(--surface, #fbf8f2)" />
      <circle cx="19" cy="33" r="3.9" fill="currentColor" stroke="var(--surface, #fbf8f2)" strokeWidth="1.2" />
      <circle cx="45" cy="33" r="3.9" fill="currentColor" stroke="var(--surface, #fbf8f2)" strokeWidth="1.2" />
      <path d="M2 36h58v6H2zM60 36l5-5v6l-5 5z" fill="currentColor" />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="logo-lockup">
      <LogoMark />
      <span className="wordmark">
        Just<i>my</i>ride
      </span>
    </span>
  );
}
