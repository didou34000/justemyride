import Link from "next/link";
import { PayLogos } from "./HomeSections";

export default function Footer() {
  return (
    <footer className="foot">
      <span>© {new Date().getFullYear()} JustMyRide · Sans lien avec les constructeurs automobiles</span>
      <PayLogos small />
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
