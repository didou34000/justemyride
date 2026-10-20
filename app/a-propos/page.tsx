import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import { SELLER } from "@/lib/legal";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({
  title: "Qui est derrière JustMyRide",
  description:
    "JustMyRide, c'est Dorian : une micro-entreprise près de Montpellier qui modélise ta voiture d'après tes photos et te montre l'aperçu 3D avant que tu paies.",
  path: "/a-propos",
});

const first = SELLER.name.split(" ")[0];

/* Uniquement des faits vérifiables (registre, fonctionnement réel du service) : pas d'histoire inventée. */
const promises = [
  ["Je regarde tes photos", "Chaque demande passe entre mes mains : les jantes, la couleur, les modifs, les petits détails qui font que c'est ta voiture et pas une autre."],
  ["Je te montre avant de te faire payer", "Tu reçois l'aperçu 3D, tu demandes des retouches si besoin. Tu ne paies que si le résultat te plaît."],
  ["Je te réponds moi-même", "Une question, un doute sur une photo : tu écris, c'est moi qui lis et qui réponds. Pas de service client à rallonge."],
];

export default function About() {
  return (
    <main>
      <Nav />
      <section className="about">
        <div className="about-text">
          <h1>
            Derrière JustMyRide, il y a <em>{first}</em>.
          </h1>
          <p className="lead">
            Pas une usine à catalogue : une micro-entreprise près de Montpellier, et une personne qui s'occupe de ta
            voiture du début à la fin.
          </p>
          <p className="about-why">
            Les miniatures du commerce existent pour les modèles de série, dans les couleurs du catalogue. Ta voiture à
            toi, avec sa teinte, ses jantes et ses modifs, n'existe nulle part en miniature. C'est exactement ce que
            JustMyRide fabrique : une pièce unique, d'après tes photos.
          </p>
        </div>
        <aside className="about-card" aria-label="Fiche">
          <div className="about-mono" aria-hidden>
            {first[0]}
          </div>
          <strong>{SELLER.name}</strong>
          <span>Fondateur de JustMyRide</span>
          <ul>
            <li>
              <span className="about-k">Statut</span> Micro-entreprise
            </li>
            <li>
              <span className="about-k">Lieu</span> Montferrier-sur-Lez (34)
            </li>
            <li>
              <span className="about-k">SIREN</span> {SELLER.siren}
            </li>
          </ul>
          <a href={`mailto:${SELLER.email}`} className="cta ghost full">
            M'écrire
          </a>
        </aside>
      </section>

      <section className="block about-promises" data-reveal>
        <h2 className="block-title">Mon engagement</h2>
        <ol>
          {promises.map(([t, d], i) => (
            <li key={t}>
              <i>{i + 1}</i>
              <b>{t}</b>
              <p>{d}</p>
            </li>
          ))}
        </ol>
        <p className="about-guarantee">
          Et si ta miniature arrive abîmée ou ne correspond pas à ta commande, je la refais ou je te rembourse.
        </p>
      </section>

      <section className="final" data-reveal>
        <h2>Montre-moi ta voiture.</h2>
        <p>Quelques photos suffisent pour commencer. L'aperçu 3D est gratuit.</p>
        <Link href="/miniature" className="cta">
          Créer ma miniature
        </Link>
      </section>
      <Footer />
      <Reveal />
    </main>
  );
}
