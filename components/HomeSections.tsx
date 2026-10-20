import Image from "next/image";
import Link from "next/link";
import HeroStage from "./HeroStage";
import { accessories, sizes } from "@/lib/options";
import { LEAD_TIME } from "@/lib/legal";
import { cars } from "@/lib/cars";
import { FaqContact, FaqList } from "./Faq";

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
  const car = cars.find((c) => c.available && c.glb)!;
  return (
    <section className="hero night">
      <div className="hero-copy">
        <h1>
          La miniature de <em>ta</em> voiture.
        </h1>
        <p className="lead">
          Fabriquée d'après tes photos, avec ses jantes, sa couleur et ses modifs. Tu vois l'aperçu 3D avant de payer.
        </p>
        <div className="hero-price">
          Dès <b>{from} €</b> · socle inclus · livraison offerte
        </div>
        <div className="hero-actions">
          <Link href="/miniature" className="cta">
            Créer ma miniature
          </Link>
          <Link href={`/configurer/${car.slug}`} className="cta ghost">
            Essayer en 3D
          </Link>
        </div>
      </div>
      <HeroStage car={car} />
    </section>
  );
}

/** Une seule ligne de réassurance juste sous le haut de page, comme sur les boutiques en ligne. */
export function TrustStrip() {
  const items = ["Pièce unique, faite pour toi", "Aperçu 3D gratuit avant de payer", "Livraison offerte en France", "Paiement sécurisé"];
  return (
    <ul className="strip" aria-label="Nos engagements">
      {items.map((i) => (
        <li key={i}>
          <Check /> {i}
        </li>
      ))}
    </ul>
  );
}

/** Tes photos, puis ce que tu reçois. À remplacer par une vraie paire photo de la voiture / photo de la miniature dès qu'elle existe. */
export function FromPhoto() {
  return (
    <section className="block from" data-reveal>
      <div className="from-pair">
        <figure>
          <Image src="/hero/photo.jpg" alt="Un conducteur photographie sa BMW M140i bleue avec son téléphone" width={1672} height={941} sizes="(max-width: 860px) 92vw, 560px" />
          <figcaption>Tes photos, prises au téléphone</figcaption>
        </figure>
        <span className="from-arrow" aria-hidden>
          →
        </span>
        <figure>
          <Image src="/shop/v2/socle-blanc.jpg" alt="Rendu 3D de la miniature de cette BMW M140i sur son socle blanc" width={1600} height={1600} sizes="(max-width: 860px) 92vw, 560px" />
          <figcaption>Ta miniature, sur son socle (rendu 3D)</figcaption>
        </figure>
      </div>
      <div className="from-text">
        <h2>Pas un modèle de catalogue. La tienne.</h2>
        <p>
          Les miniatures du commerce existent dans les couleurs d'usine. Ici, on reproduit ta voiture telle qu'elle est :
          sa teinte, ses jantes, son kit, son aileron, sa hauteur.
        </p>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    ["Tu envoies tes photos", "6 vues autour de la voiture, au téléphone. Plus tu en mets, plus elle est fidèle."],
    ["Tu valides ton aperçu 3D", "Gratuit. Tu demandes des retouches si besoin, puis tu choisis la taille et tu commandes."],
    ["On la fabrique et on te l'envoie", `Fabriquée à la commande en ${LEAD_TIME} environ, livrée chez toi.`],
  ];
  return (
    <section className="block" id="comment" data-reveal>
      <h2 className="block-title">Comment ça marche</h2>
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
      <Link href="/miniature" className="cta">
        Créer ma miniature
      </Link>
    </section>
  );
}

/** Les 3 tailles à côté d'une canette de 33 cl (11,5 cm) : « 18 cm » ne parle à personne, une canette si. */
export function SizeCompare({ active }: { active?: string }) {
  const CM = 9; // pixels par centimètre dans le dessin
  const cm = (s: string) => Number(s.replace(/[^\d,]/g, "").replace(",", "."));
  const H = 12.5 * CM;
  let x = 10;
  const items = [
    { id: "can", w: 6.6 * CM, h: 11.5 * CM, label: "Canette 33 cl" },
    ...sizes.map((s) => ({ id: s.id, w: cm(s.length) * CM, h: cm(s.length) * CM * 0.33, label: `${s.label} · ${s.length.replace("≈ ", "")}` })),
  ].map((it) => {
    const o = { ...it, x };
    x += it.w + 22;
    return o;
  });
  return (
    <svg className="size-compare" viewBox={`0 0 ${x} ${H + 30}`} role="img" aria-label="Les trois tailles comparées à une canette de 33 cl">
      <line x1="0" x2={x} y1={H} y2={H} className="sc-floor" />
      {items.map((it) =>
        it.id === "can" ? (
          <g key={it.id} className="sc-can">
            <rect x={it.x} y={H - it.h} width={it.w} height={it.h} rx="6" />
            <text x={it.x + it.w / 2} y={H + 20} textAnchor="middle">
              {it.label}
            </text>
          </g>
        ) : (
          <g key={it.id} className={`sc-car ${active === it.id ? "on" : ""}`}>
            {/* Silhouette de profil : capot, pavillon, coffre, deux roues. */}
            <path
              d={`M${it.x} ${H - it.h * 0.25} L${it.x + it.w * 0.02} ${H - it.h * 0.55} L${it.x + it.w * 0.25} ${H - it.h * 0.62} L${it.x + it.w * 0.4} ${H - it.h} L${it.x + it.w * 0.72} ${H - it.h} L${it.x + it.w * 0.88} ${H - it.h * 0.6} L${it.x + it.w} ${H - it.h * 0.52} L${it.x + it.w} ${H - it.h * 0.2} Z`}
            />
            <circle cx={it.x + it.w * 0.2} cy={H - it.h * 0.2} r={it.h * 0.2} className="sc-wheel" />
            <circle cx={it.x + it.w * 0.8} cy={H - it.h * 0.2} r={it.h * 0.2} className="sc-wheel" />
            <text x={it.x + it.w / 2} y={H + 20} textAnchor="middle">
              {it.label}
            </text>
          </g>
        ),
      )}
    </svg>
  );
}

export function Sizes() {
  return (
    <section className="block" id="tailles" data-reveal>
      <div className="block-head">
        <h2>Trois tailles</h2>
        <p>Socle blanc inclus. Livraison standard offerte en France.</p>
      </div>
      <SizeCompare active="1-24" />
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
      <p className="extras-line">
        En option : {accessories.map((a, i) => (
          <span key={a.id}>
            {i > 0 && " · "}
            {a.label.toLowerCase()} (+{a.price} €)
          </span>
        ))}
      </p>
    </section>
  );
}

export function Gift() {
  return (
    <section className="gift" data-reveal>
      <Image src="/shop/v2/socle-noir.jpg" alt="Rendu 3D d'une miniature sur socle noir gravé" width={1600} height={1600} sizes="(max-width: 860px) 92vw, 480px" />
      <div>
        <h2>Un cadeau que personne n'a déjà</h2>
        <p>
          Pour un anniversaire, Noël ou le premier jour avec sa voiture. Prends quelques photos de sa voiture en douce, on
          s'occupe du reste. Le socle noir peut porter un petit texte gravé.
        </p>
        <Link href="/offrir" className="cta dark">
          Offrir une miniature
        </Link>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section className="block faq" id="faq" data-reveal>
      <h2 className="block-title">Questions fréquentes</h2>
      <FaqList ids={["photos", "engagement", "delai", "fidele"]} />
      <p className="faq-more">
        <Link href="/faq">Toutes les questions →</Link>
      </p>
      <FaqContact />
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="final" data-reveal>
      <h2>Ta voiture mérite sa miniature.</h2>
      <p>Quelques photos, deux minutes, et l'aperçu 3D est gratuit.</p>
      <Link href="/miniature" className="cta">
        Créer ma miniature
      </Link>
    </section>
  );
}
