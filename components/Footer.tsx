import Link from "next/link";

export default function Footer() {
  return (
    <footer className="foot">
      <span>© {new Date().getFullYear()} JustMyRide</span>
      <nav className="foot-links">
        <Link href="/configurer">Le garage</Link>
        <Link href="/cgv">CGV</Link>
        <Link href="/confidentialite">Confidentialité</Link>
        <Link href="/mentions-legales">Mentions légales</Link>
        <Link href="/admin">Admin</Link>
      </nav>
    </footer>
  );
}
