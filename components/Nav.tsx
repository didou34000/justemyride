import Link from "next/link";
import Logo from "./Logo";

/** En-tête de toutes les pages. Le bouton de droite mène par défaut à l'envoi des photos ; « ghost » quand la page a déjà son bouton principal. */
export default function Nav({ link = { href: "/envoyer", label: "Envoyer mes photos" } }: { link?: { href: string; label: string; ghost?: boolean } }) {
  return (
    <header className="nav">
      <Link href="/" className="logo" aria-label="JustMyRide, accueil">
        <Logo />
      </Link>
      <nav className="nav-links" aria-label="Navigation principale">
        <Link href="/#comment">Comment ça marche</Link>
        <Link href="/#tailles">Tailles et prix</Link>
        <Link href="/configurer">Le garage</Link>
        <Link href="/#faq">FAQ</Link>
      </nav>
      <Link href={link.href} className={`cta nav-cta ${link.ghost ? "ghost" : ""}`}>
        {link.label}
      </Link>
    </header>
  );
}
