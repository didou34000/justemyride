import Link from "next/link";
import Logo from "./Logo";
import { PayLogos } from "./HomeSections";
import { SELLER } from "@/lib/legal";

export default function Footer() {
  return (
    <footer className="foot">
      <div className="foot-top">
        <div className="foot-brand">
          <Logo />
          <p>Miniatures de voitures personnalisées, fabriquées en pièce unique.</p>
          <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a>
        </div>
        <nav className="foot-col" aria-label="Le site">
          <b>Le site</b>
          <Link href="/envoyer">Envoyer mes photos</Link>
          <Link href="/configurer">Le garage</Link>
          <Link href="/#tailles">Tailles et prix</Link>
          <Link href="/#faq">FAQ</Link>
          <Link href="/a-propos">Qui est derrière</Link>
        </nav>
        <nav className="foot-col" aria-label="Informations légales">
          <b>Informations</b>
          <Link href="/cgv">Conditions de vente</Link>
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/mentions-legales">Mentions légales</Link>
        </nav>
      </div>
      <div className="foot-bottom">
        <span>
          {/* Accès au tableau de bord, discret : le « © » mène à /admin (protégé par mot de passe). */}
          <Link href="/admin" rel="nofollow" className="foot-admin" aria-label="Espace administrateur">
            ©
          </Link>{" "}
          {new Date().getFullYear()} JustMyRide · Sans lien avec les constructeurs automobiles
        </span>
        <PayLogos small />
      </div>
    </footer>
  );
}
