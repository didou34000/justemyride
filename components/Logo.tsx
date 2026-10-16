/** Le signe JustMyRide : une petite voiture posée sur son socle rond. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="currentColor" aria-hidden>
      <defs>
        <mask id="jmr-cut">
          <rect width="28" height="28" fill="#fff" />
          <path d="M10.4 14.2 13.3 11.8h2.4v2.4zM16.7 11.8h2.6l2.3 2.4h-4.9z" fill="#000" />
          <circle cx="8.6" cy="19" r="2.9" fill="#000" />
          <circle cx="19.6" cy="19" r="2.9" fill="#000" />
        </mask>
      </defs>
      <path
        mask="url(#jmr-cut)"
        d="M3.6 19v-2.6q0-1.2 1.2-1.5l4.4-1.1 3.4-2.9q.6-.5 1.4-.5h5.6q.9 0 1.4.6l2.5 3q.9.4.9 1.4V19z"
      />
      <circle cx="8.6" cy="19" r="2" />
      <circle cx="19.6" cy="19" r="2" />
      <rect x="2" y="22.4" width="24" height="3.4" rx="1.7" />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="logo-lockup">
      <LogoMark />
      <span>
        just<b>my</b>ride
      </span>
    </span>
  );
}
