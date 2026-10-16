import Link from "next/link";
import Nav from "@/components/Nav";
import Uploader from "@/components/Uploader";
import ShelfPreview from "@/components/ShelfPreview";
import { cars } from "@/lib/cars";
import { sizes } from "@/lib/options";

const TIPS = [
  ["Lumière douce", "Temps couvert ou ombre. Pas de soleil direct ni de contre-jour."],
  ["Voiture entière", "Toute la voiture dans le cadre, à hauteur des phares, à 3 ou 4 mètres."],
  ["Fond dégagé", "Un parking vide ou un mur uni. Évite les autres voitures autour."],
  ["Voiture propre", "Les reflets et la saleté perturbent la modélisation."],
];

const STEPS = [
  ["Tu la prends en photo", "8 photos en faisant le tour. Le guide te montre où te placer."],
  ["Tu la personnalises", "On la modélise en 3D. Tu choisis teinte, jantes, échappement, taille."],
  ["Tu la poses chez toi", "Fabriquée en pièce unique, à l'échelle, livrée prête à exposer."],
];

const from = Math.min(...sizes.map((s) => s.price));
const example = cars.find((c) => c.available && c.glb)!;

export default function Home() {
  return (
    <main>
      <Nav link={{ href: "/configurer", label: "Le garage" }} />

      <section className="hero">
        <div>
          <h1>
            Ta voiture.
            <br />
            <span>En miniature.</span>
          </h1>
          <p className="lead">
            Prends-la en photo. On la modélise, tu la personnalises, et elle finit sur ton étagère, en pièce unique.
          </p>
        </div>
        <div className="hero-side">
          <div className="hero-actions">
            <a href="#deposer" className="cta">
              Envoyer mes photos
            </a>
            <Link href="/configurer" className="arrow-link">
              Voir le garage →
            </Link>
          </div>
          <p>
            Dès {from} € · {sizes.map((s) => s.label).join(", ")}
          </p>
        </div>
      </section>

      <section className="show" aria-label="De la photo à la miniature">
        <figure>
          <div className="panel-img shot">
            <img src="/cars/bmw-m140i.jpg" alt="Une BMW M140i bleue cadrée dans l'appareil photo d'un téléphone" />
            <div className="vf" aria-hidden>
              <i />
              <i />
              <i />
              <i />
              <span className="vf-top">3/4 avant gauche · 2 sur 8</span>
              <div className="vf-bar">
                <span className="shutter" />
              </div>
            </div>
          </div>
          <figcaption>
            <b>01</b> Ta voiture, prise en photo.
          </figcaption>
        </figure>
        <figure>
          <div className="panel-img mini">
            <ShelfPreview car={example} />
          </div>
          <figcaption>
            <b>02</b> Ta miniature, sur ton étagère.
          </figcaption>
        </figure>
      </section>

      <section className="how">
        {STEPS.map(([t, d], i) => (
          <div key={t}>
            <b>0{i + 1}</b>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </section>

      <section className="home">
        <div className="home-copy">
          <p className="eyebrow">Commencer</p>
          <h2>Envoie 8 photos de ta voiture.</h2>
          <p className="lead">On t'écrit dès que ton modèle 3D est prêt à personnaliser.</p>
          <ul className="tips-list">
            {TIPS.map(([t, d]) => (
              <li key={t}>
                <b>{t}</b>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
        <Uploader />
      </section>

      <footer className="foot">
        <span>© {new Date().getFullYear()} JustMyRide</span>
        <Link href="/configurer" className="link">
          Le garage
        </Link>
      </footer>
    </main>
  );
}
