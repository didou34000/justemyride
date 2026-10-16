import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Uploader from "@/components/Uploader";

export const metadata = { title: "Envoyer mes photos — JustMyRide" };

const TIPS = [
  ["Lumière douce", "Temps couvert ou ombre. Pas de soleil direct ni de contre-jour."],
  ["Voiture entière", "Toute la voiture dans le cadre, à hauteur des phares, à 3 ou 4 mètres. Le guide te montre chaque angle."],
  ["Fond dégagé", "Un parking vide ou un mur uni. Évite les autres voitures autour."],
  ["Voiture propre", "Les reflets et la saleté perturbent la modélisation."],
];

export default function SendPage() {
  return (
    <main>
      <Nav cta={{ href: "/configurer", label: "Catalogue" }} />
      <div className="wrap">
        <section className="home">
          <div>
            <p className="eyebrow">Ta voiture n'est pas au catalogue</p>
            <h1>
              Envoie-nous
              <br />
              <span>ta voiture.</span>
            </h1>
            <p className="lead">
              Prends-la en photo en suivant le guide, angle par angle. On la modélise en 3D, puis tu choisis couleur,
              jantes et pièces comme pour les voitures du catalogue.
            </p>
            <ol className="how">
              <li>
                <b>01</b>Tu envoies tes photos
              </li>
              <li>
                <b>02</b>On modélise ta voiture
              </li>
              <li>
                <b>03</b>Tu personnalises et commandes
              </li>
            </ol>
          </div>
          <Uploader />
        </section>

        <section className="tips">
          <p className="eyebrow">Pour un modèle fidèle</p>
          <div className="tips-grid">
            {TIPS.map(([t, d]) => (
              <div key={t}>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
