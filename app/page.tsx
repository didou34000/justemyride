import Nav from "@/components/Nav";
import Uploader from "@/components/Uploader";

const TIPS = [
  ["Lumière douce", "Temps couvert ou ombre. Pas de soleil direct ni de contre-jour."],
  ["Voiture entière", "Toute la voiture dans le cadre, à hauteur des phares, à 3 ou 4 mètres. Le guide te montre chaque angle."],
  ["Fond dégagé", "Un parking vide ou un mur uni. Évite les autres voitures autour."],
  ["Voiture propre", "Les reflets et la saleté perturbent la modélisation."],
];

export default function Home() {
  return (
    <main>
      <Nav link={{ href: "/configurer", label: "Configurateur" }} />

      <section className="home">
        <div className="home-copy">
          <p className="eyebrow">Miniatures sur mesure</p>
          <h1>
            Ta voiture.
            <br />
            <span>En miniature.</span>
          </h1>
          <p className="lead">
            Prends ta voiture en photo en suivant le guide. On la modélise en 3D, tu choisis teinte, jantes et
            plaque, et on la fabrique en pièce unique.
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

      <footer className="foot">© {new Date().getFullYear()} JustMyRide</footer>
    </main>
  );
}
