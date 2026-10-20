import Image from "next/image";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { LEAD_TIME, SELLER } from "@/lib/legal";
import { accessories, sizes } from "@/lib/options";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({
  title: "Offrir la miniature de sa voiture",
  description: "Une idée cadeau unique pour un passionné : la miniature de sa propre voiture, d'après quelques photos. Socle gravé en option, aperçu 3D gratuit avant de payer.",
  path: "/offrir",
  image: { url: "/shop/v2/socle-noir.jpg", width: 1600, height: 1600, alt: "Rendu 3D d'une miniature sur socle noir gravé" },
});

const from = Math.min(...sizes.map((s) => s.price));
const socle = accessories.find((a) => a.id === "socle")!;

const steps = [
  ["Prends ses photos en douce", "Les 6 vues autour de la voiture (face, côtés, 3/4, arrière), garée dans la rue ou sur le parking. Plus il y en a, mieux c'est."],
  ["Envoie-les avec ton e-mail", "C'est toi qui reçois l'aperçu 3D, pas la personne à qui tu l'offres. La surprise reste entière."],
  ["Choisis la taille et le socle", `Le socle noir gravé (+${socle.price} €) peut porter un petit texte : un prénom, une date, une plaque.`],
  ["On l'envoie chez toi", `Fabriquée en ${LEAD_TIME} environ. Pense à commander tôt pour une date précise.`],
];

export default function GiftPage() {
  return (
    <main>
      <Nav />
      <section className="gift-hero">
        <div>
          <h1>Offrir la miniature de sa voiture</h1>
          <p className="lead">
            Pour un passionné, c'est un cadeau que personne n'a déjà : sa propre voiture, en pièce unique, à poser sur son
            bureau. Dès {from} €.
          </p>
          <Link href="/miniature" className="cta">
            Commencer avec ses photos
          </Link>
        </div>
        <Image src="/shop/v2/socle-noir.jpg" alt="Rendu 3D d'une miniature sur socle noir gravé" width={1600} height={1600} sizes="(max-width: 860px) 92vw, 520px" priority />
      </section>

      <section className="block">
        <h2 className="block-title">Comment faire la surprise</h2>
        <ol className="steps">
          {steps.map(([t, d], i) => (
            <li key={t}>
              <i>{i + 1}</i>
              <div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="block">
        <div className="gift-card-box">
          <h2>Tu n'as pas de photos de sa voiture ?</h2>
          <p>
            La carte cadeau en ligne arrive bientôt. En attendant, écris-moi : on trouve une solution ensemble pour que tu
            puisses l'offrir quand même.
          </p>
          <a href={`mailto:${SELLER.email}?subject=${encodeURIComponent("Offrir une miniature")}`} className="cta ghost">
            M'écrire
          </a>
        </div>
      </section>
      <Footer />
    </main>
  );
}
