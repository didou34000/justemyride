import Link from "next/link";
import TryIt from "./TryIt";
import { accessories, sizes } from "@/lib/options";
import { LEAD_TIME, SELLER } from "@/lib/legal";
import type { Car } from "@/lib/cars";

/*
 * Sections de l'accueil. Tout ce qui est affirmé ici doit rester vrai et cohérent avec les CGV
 * et la boutique Shopify : pas d'avis inventés, pas de chiffres de ventes, pas de délai non tenu.
 */

const from = Math.min(...sizes.map((s) => s.price));

function Check() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
      <circle cx="10" cy="10" r="10" fill="currentColor" opacity=".12" />
      <path d="M6 10.3l2.6 2.6L14.2 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PAY = [
  ["visa", "Visa"],
  ["mastercard", "Mastercard"],
  ["paypal", "PayPal"],
  ["klarna", "Klarna"],
  ["shoppay", "Shop Pay"],
  ["applepay", "Apple Pay"],
] as const;

export function PayLogos({ small }: { small?: boolean }) {
  return (
    <ul className={`pay ${small ? "small" : ""}`} aria-label="Moyens de paiement acceptés">
      {PAY.map(([id, name]) => (
        <li key={id} title={name}>
          <img src={`/pay/${id}.svg`} alt={name} />
        </li>
      ))}
    </ul>
  );
}

export function Hero() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <h1>La miniature de ta voiture.</h1>
        <p className="lead">
          Pas un modèle de catalogue : ta voiture, avec ses jantes, sa couleur et ses modifs. Envoie tes photos,
          valide l'aperçu 3D, on la fabrique en pièce unique.
        </p>
        <div className="hero-actions">
          <Link href="/envoyer" className="cta">
            Envoyer mes photos
          </Link>
          <Link href="/configurer" className="cta ghost">
            Voir le garage
          </Link>
        </div>
        <ul className="hero-facts">
          <li>
            <Check /> Dès {from} €
          </li>
          <li>
            <Check /> Aperçu 3D gratuit, sans engagement
          </li>
          <li>
            <Check /> Livraison offerte en France
          </li>
        </ul>
      </div>
      <div className="hero-visual">
        <figure className="hv-main">
          <img src="/shop/v2/socle-noir.jpg" alt="Rendu 3D de la miniature d'une BMW M140i bleue sur un socle noir gravé" width={1600} height={1600} fetchPriority="high" />
          <figcaption>Ta miniature</figcaption>
        </figure>
        <figure className="hv-photo">
          <img src="/hero/photo.jpg" alt="Un conducteur photographie sa BMW bleue avec son téléphone" width={1672} height={941} />
          <figcaption>Ta photo</figcaption>
        </figure>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps: { img: string; alt: string; pos?: string; t: string; d: string }[] = [
    {
      img: "/hero/photo.jpg",
      alt: "Un conducteur photographie sa BMW M140i bleue avec son téléphone",
      pos: "28% 50%",
      t: "Tu envoies tes photos",
      d: "Au minimum un trois quarts avant et un trois quarts arrière, au téléphone. Ajoute-en autant que tu veux : plus il y en a, plus elle est fidèle.",
    },
    {
      img: "/cars/bmw-m140i.jpg",
      alt: "Aperçu 3D de la même BMW M140i bleue",
      t: "Tu valides ton aperçu 3D",
      d: "On recrée ta voiture en 3D et on te l'envoie par e-mail. Tu choisis la taille et les options, puis tu commandes.",
    },
    {
      img: "/shop/v2/socle-blanc.jpg",
      alt: "Rendu 3D de la miniature de cette BMW M140i sur son socle blanc",
      t: "On la fabrique pour toi",
      d: `Fabriquée à la commande en ${LEAD_TIME} environ, puis expédiée chez toi.`,
    },
  ];
  return (
    <section className="block" id="comment">
      <div className="block-head">
        <h2>Comment ça marche</h2>
        <p>Trois étapes, et tu ne paies qu'à la fin, une fois l'aperçu validé.</p>
      </div>
      <ol className="how">
        {steps.map((s, i) => (
          <li key={s.t}>
            <img src={s.img} alt={s.alt} loading="lazy" width={1200} height={900} style={s.pos ? { objectPosition: s.pos } : undefined} />
            <span className="how-n">Étape {i + 1}</span>
            <h3>{s.t}</h3>
            <p>{s.d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Preview3D({ car }: { car: Car }) {
  return (
    <section className="block try-block">
      <TryIt car={car} />
    </section>
  );
}

/** Le manifeste : ce qui fait la différence avec une miniature de série. */
export function Manifesto() {
  const items = ["Couleur exacte", "Jantes", "Étriers", "Échappement", "Hauteur", "Vitres teintées", "Chromes noirs", "Plaque gravée"];
  return (
    <section className="band">
      <div className="band-in">
        <p className="band-quote">
          Une miniature de série, c'est la voiture de tout le monde. <span>Ici, c'est la tienne.</span>
        </p>
        <ul className="band-list" aria-label="Ce que tu peux personnaliser">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Sizes() {
  const extras = [
    { img: "/shop/v2/socle-noir.jpg", a: accessories.find((a) => a.id === "socle")!, d: "Plaque gravée du texte de ton choix." },
    { img: "/shop/v2/vitrine.jpg", a: accessories.find((a) => a.id === "vitrine")!, d: "À l'abri de la poussière." },
  ];
  return (
    <section className="block" id="tailles">
      <div className="block-head">
        <h2>Tailles et prix</h2>
        <p>Prix tout compris pour la miniature et son socle blanc. Livraison standard offerte en France.</p>
      </div>
      <ul className="price-cards">
        {sizes.map((s) => (
          <li key={s.id} className={s.id === "1-24" ? "pick" : ""}>
            {s.id === "1-24" && <span className="tag">Notre conseil</span>}
            <span className="pc-scale">Échelle {s.label}</span>
            <span className="pc-price">{s.price} €</span>
            <span className="pc-len">{s.length} de long</span>
          </li>
        ))}
      </ul>
      <ul className="extras">
        {extras.map(({ img, a, d }) => (
          <li key={a.id}>
            <img src={img} alt={`Rendu 3D : miniature avec ${a.label.toLowerCase()}`} loading="lazy" width={1600} height={1600} />
            <div>
              <b>{a.label}</b>
              <span>
                + {a.price} € · {d}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Trust() {
  const items = [
    ["Refaite ou remboursée", "Abîmée à la livraison ou différente de ta commande : on la refait ou on te rembourse, sans frais."],
    ["Paiement sécurisé", "Le paiement passe par Shopify. On ne voit jamais tes coordonnées bancaires."],
    ["Tes photos restent privées", "Elles servent uniquement à modéliser ta voiture. Tu peux demander leur suppression quand tu veux."],
    ["Vérifiée avant fabrication", "Chaque modèle 3D est contrôlé à la main et validé par toi avant d'être fabriqué."],
  ];
  return (
    <section className="block">
      <ul className="trust">
        {items.map(([t, d]) => (
          <li key={t}>
            <b>{t}</b>
            <p>{d}</p>
          </li>
        ))}
      </ul>
      <PayLogos />
    </section>
  );
}

export function Faq() {
  const qa: [string, React.ReactNode][] = [
    [
      "Combien de photos faut-il ?",
      <>
        Au minimum 2 : un trois quarts avant et un trois quarts arrière. Il n'y a pas de maximum : profil, face, arrière,
        jantes, gros plans des modifs (kit, aileron, autocollants)… Plus on en a, plus la miniature est fidèle.
      </>,
    ],
    [
      "Ça m'engage à quelque chose d'envoyer mes photos ?",
      <>Non. L'envoi et l'aperçu 3D sont gratuits. Tu ne paies que si tu commandes ta miniature.</>,
    ],
    [
      "Combien de temps pour la recevoir ?",
      <>
        Chaque miniature est fabriquée à la commande : environ {LEAD_TIME} de fabrication, puis le transport. La
        livraison standard est offerte en France ; l'express et l'envoi hors de France sont payants, leur prix s'affiche
        au paiement.
      </>,
    ],
    [
      "Est-ce que la miniature ressemblera vraiment à l'aperçu 3D ?",
      <>Oui, c'est le même modèle. De légers écarts de teinte ou de détails sont possibles à petite échelle, surtout en 1:43.</>,
    ],
    [
      "Et si elle arrive abîmée ?",
      <>Écris-nous avec une photo : on la refait ou on te rembourse, sans frais. Les garanties légales s'appliquent aussi.</>,
    ],
    [
      "Je peux la renvoyer si je change d'avis ?",
      <>
        Non : c'est une pièce unique fabriquée sur mesure, le droit de rétractation ne s'applique pas. Prends le temps de
        bien valider l'aperçu, il est là pour ça.
      </>,
    ],
    [
      "Que deviennent mes photos ?",
      <>
        Elles sont stockées dans un espace privé et servent uniquement à modéliser ta voiture. Tu peux demander leur
        suppression à tout moment. Détails dans la <Link href="/confidentialite">politique de confidentialité</Link>.
      </>,
    ],
    [
      "Comment je paie ?",
      <>
        Sur la page de paiement sécurisée de Shopify : carte bancaire, PayPal, Klarna ou Shop Pay, et Apple Pay sur
        iPhone, iPad et Mac.
      </>,
    ],
  ];
  return (
    <section className="block faq" id="faq">
      <div className="block-head">
        <h2>Questions fréquentes</h2>
      </div>
      <div className="faq-list">
        {qa.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
      <p className="faq-contact">
        Une autre question ? Écris-nous à <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a>
      </p>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="final">
      <h2>Ta voiture mérite sa miniature.</h2>
      <p>Quelques photos, quelques minutes, et on s'occupe du reste.</p>
      <Link href="/envoyer" className="cta">
        Envoyer mes photos
      </Link>
    </section>
  );
}
