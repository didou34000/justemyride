import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Uploader from "@/components/Uploader";
import { LEAD_TIME } from "@/lib/legal";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({
  title: "Envoie ta voiture : 2 photos suffisent",
  description:
    "Choisis ton modèle, envoie 2 photos de ta voiture et reçois ton aperçu 3D gratuit par e-mail. Sans engagement : tu ne paies que si tu commandes ta miniature.",
  path: "/envoyer",
});

function Check() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
      <path d="M5 10.3l3.2 3.2L15 6.7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SendPage() {
  return (
    <main>
      <Nav link={{ href: "/configurer", label: "Voir le garage", ghost: true }} />
      <div className="send">
        <header className="send-head">
          <h1>Envoie ta voiture</h1>
          <p className="lead">Gratuit et sans engagement. Ça prend deux minutes, et tu reçois ton aperçu 3D par e-mail.</p>
        </header>
        <div className="send-grid">
          <Uploader />
          <aside className="send-aside">
            <section>
              <h2>Ensuite</h2>
              <ol>
                <li>
                  <span>
                    <b>On recrée ta voiture en 3D</b> à partir de tes photos, avec ses jantes et ses modifs.
                  </span>
                </li>
                <li>
                  <span>
                    <b>Tu reçois ton aperçu</b> par e-mail, tu choisis la taille et les options.
                  </span>
                </li>
                <li>
                  <span>
                    <b>Tu commandes si ça te plaît.</b> Fabrication en {LEAD_TIME} environ.
                  </span>
                </li>
              </ol>
            </section>
            <section>
              <ul>
                <li>
                  <Check /> Rien à payer pour l'aperçu
                </li>
                <li>
                  <Check /> Tes photos restent privées
                </li>
                <li>
                  <Check /> Livraison offerte en France
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
      <Footer />
    </main>
  );
}
