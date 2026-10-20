import Link from "next/link";
import Logo from "./Logo";
import { LEAD_TIME } from "@/lib/legal";

/** En-tête de toutes les pages : barre d'annonce, logo, menu, et l'action principale (la fiche produit). */
export default function Nav({ link = { href: "/miniature", label: "Créer ma miniature" } }: { link?: { href: string; label: string; ghost?: boolean } }) {
  return (
    <>
      <p className="announce">
        Livraison offerte en France<span className="announce-more"> <span aria-hidden>·</span> Fabriquée à la commande en {LEAD_TIME}</span>
      </p>
      <header className="nav">
        <Link href="/" className="logo" aria-label="JustMyRide, accueil">
          <Logo />
        </Link>
        <nav className="nav-links" aria-label="Navigation principale">
          <Link href="/miniature">La miniature</Link>
          <Link href="/offrir">Offrir</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/a-propos">Qui est derrière</Link>
        </nav>
        <Link href={link.href} className={`cta nav-cta ${link.ghost ? "ghost" : ""}`}>
          {link.label}
        </Link>
      </header>
    </>
  );
}
