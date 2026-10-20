import Link from "next/link";
import Logo from "./Logo";
import { PayLogos } from "./HomeSections";
import { cars } from "@/lib/cars";
import { SELLER } from "@/lib/legal";

const demo = cars.find((c) => c.available && c.glb);

export default function Footer() {
  return (
    <footer className="foot">
      <div className="foot-top">
        <div className="foot-brand">
          <Logo />
          <p>Miniatures de voitures personnalisées, fabriquées en pièce unique d'après tes photos.</p>
          <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a>
        </div>
        <nav className="foot-col" aria-label="Boutique">
          <b>Boutique</b>
          <Link href="/miniature">La miniature</Link>
          <Link href="/offrir">Offrir</Link>
          {demo && <Link href={`/configurer/${demo.slug}`}>Essayer en 3D</Link>}
        </nav>
        <nav className="foot-col" aria-label="Aide">
          <b>Aide</b>
          <Link href="/faq">Questions fréquentes</Link>
          <Link href="/faq#livraison">Livraison</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <nav className="foot-col" aria-label="Informations">
          <b>JustMyRide</b>
          <Link href="/a-propos">Qui est derrière</Link>
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
