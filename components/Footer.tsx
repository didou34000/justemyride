import Link from "next/link";

export default function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <Link href="/" className="logo">
              JUST<b>MY</b>RIDE
            </Link>
            <p>Ta voiture en miniature, fabriquée à la commande en pièce unique.</p>
          </div>
          <div>
            <h4>Créer</h4>
            <ul>
              <li><Link href="/configurer">Configurateur 3D</Link></li>
              <li><Link href="/envoyer">Envoyer mes photos</Link></li>
            </ul>
          </div>
          <div>
            <h4>Découvrir</h4>
            <ul>
              <li><Link href="/#exemples">Exemples</Link></li>
              <li><Link href="/#comment">Comment ça marche</Link></li>
              <li><Link href="/#prix">Tailles et prix</Link></li>
            </ul>
          </div>
          <div>
            <h4>Aide</h4>
            <ul>
              <li><Link href="/#faq">Questions fréquentes</Link></li>
            </ul>
          </div>
        </div>
        <p className="foot-bottom">© {new Date().getFullYear()} JustMyRide</p>
      </div>
    </footer>
  );
}
