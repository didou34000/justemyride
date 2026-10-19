import Link from "next/link";
import { CarGlyph } from "./Logo";
import { accessories, sizes } from "@/lib/options";
import { LEAD_TIME, SELLER } from "@/lib/legal";

/*
 * Sections de réassurance de l'accueil. Tout ce qui est affirmé ici doit rester vrai
 * et cohérent avec les CGV : pas d'avis inventés, pas de chiffres de ventes fictifs.
 */

const icon = {
  unique: "M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z",
  truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 100-4 2 2 0 000 4zm11 0a2 2 0 100-4 2 2 0 000 4z",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3",
};

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const PAY = [
  ["visa", "Visa"],
  ["mastercard", "Mastercard"],
  ["paypal", "PayPal"],
  ["klarna", "Klarna"],
  ["applepay", "Apple Pay"],
  ["googlepay", "Google Pay"],
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

export function TrustBar() {
  const items = [
    [icon.unique, "Pièce unique"],
    [icon.truck, "Livraison offerte en France"],
    [icon.shield, "Refaite ou remboursée"],
    [icon.lock, "Paiement sécurisé"],
  ] as const;
  return (
    <section className="trust" aria-label="Nos garanties">
      <ul className="trust-grid">
        {items.map(([d, t]) => (
          <li key={t}>
            <Icon d={d} />
            <b>{t}</b>
          </li>
        ))}
      </ul>
      <PayLogos />
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    ["Ta voiture", "Choisis-la, ou envoie 8 photos."],
    ["En 3D", "On la recrée, tu la personnalises."],
    ["En vrai", `Expédiée sous ${LEAD_TIME}, chez toi.`],
  ];
  return (
    <section className="home-block">
      <h2>
        3 étapes, <i>c'est tout.</i>
      </h2>
      <ol className="steps3">
        {steps.map(([t, d], i) => (
          <li key={t}>
            <span className="num">{String(i + 1).padStart(2, "0")}</span>
            <h3>{t}</h3>
            <p>{d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function BeforeAfter() {
  return (
    <section className="home-block">
      <h2>
        Ta photo devient <i>ta miniature.</i>
      </h2>
      <div className="ba">
        <figure>
          <img src="/hero/photo.jpg" alt="Un conducteur photographie sa BMW bleue avec son téléphone" loading="lazy" />
          <figcaption>Tu prends ta voiture en photo</figcaption>
        </figure>
        <span className="ba-arrow" aria-hidden>
          →
        </span>
        <figure>
          <img src="/shop/socle-noir-grave.jpg" alt="Rendu 3D de la miniature d'une BMW M140i bleue sur un socle noir gravé" loading="lazy" />
          <figcaption>On en fait ta miniature</figcaption>
        </figure>
      </div>
    </section>
  );
}

export function Sizes() {
  return (
    <section className="home-block" id="tailles">
      <h2>Du bureau à la vitrine.</h2>
      <ul className="size-cards">
        {sizes.map((s, i) => (
          <li key={s.id} className={s.id === "1-24" ? "pop" : ""}>
            {s.id === "1-24" && <em>Conseillée</em>}
            <div className="size-visual" aria-hidden>
              <CarGlyph size={[30, 46, 62][i]} />
            </div>
            <strong>{s.label}</strong>
            <span>{s.length} de long</span>
            <b>{s.price} €</b>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Finishes() {
  const socle = accessories.find((a) => a.id === "socle")!;
  const vitrine = accessories.find((a) => a.id === "vitrine")!;
  const items = [
    ["/shop/miniature.jpg", "Socle rond blanc", "Inclus avec chaque miniature."],
    ["/shop/socle-noir-grave.jpg", "Socle noir gravé", `+${socle.price} € · plaque au nom de ta voiture.`],
    ["/shop/vitrine-acrylique.jpg", "Vitrine acrylique", `+${vitrine.price} € · à l'abri de la poussière.`],
  ];
  return (
    <section className="home-block">
      <h2>Prête à exposer.</h2>
      <ul className="finish-grid">
        {items.map(([src, t, d]) => (
          <li key={t}>
            <img src={src} alt={`Rendu 3D : miniature avec ${t.toLowerCase()}`} loading="lazy" />
            <b>{t}</b>
            <span>{d}</span>
          </li>
        ))}
      </ul>
      <Link href="/configurer" className="cta ghost">
        Configurer la mienne
      </Link>
    </section>
  );
}

export function Faq() {
  const qa: [string, React.ReactNode][] = [
    [
      "Ma voiture n'est pas dans le garage, je fais comment ?",
      <>Envoie 8 photos de ta voiture plus haut. C'est gratuit et sans engagement : on la modélise en 3D et on t'écrit pour que tu la personnalises.</>,
    ],
    [
      "Combien de temps pour la recevoir ?",
      <>Chaque miniature est fabriquée à la commande : environ {LEAD_TIME} de fabrication, puis le transport. La livraison standard est offerte en France ; l'express et l'envoi hors de France sont payants, leur prix s'affiche au paiement.</>,
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
      <>Non : c'est une pièce unique fabriquée sur mesure, le droit de rétractation ne s'applique pas. Prends le temps de bien la configurer, l'aperçu est là pour ça.</>,
    ],
    [
      "Que deviennent mes photos ?",
      <>
        Elles sont stockées dans un espace privé et servent uniquement à modéliser ta voiture. Tu peux demander leur suppression à tout moment.
        Détails dans la <Link href="/confidentialite">politique de confidentialité</Link>.
      </>,
    ],
    [
      "Comment je paie ?",
      <>Sur la page de paiement sécurisée de Shopify : carte bancaire, PayPal, Klarna, Apple Pay ou Google Pay. Nous ne voyons jamais tes coordonnées bancaires.</>,
    ],
  ];
  return (
    <section className="home-block faq" id="faq">
      <h2>Tout ce qu'on nous demande.</h2>
      <div className="faq-list">
        {qa.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
      <p className="faq-contact">
        Une autre question ? <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a>
      </p>
    </section>
  );
}
