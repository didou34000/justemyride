import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import ProductPage from "@/components/ProductPage";
import { FaqContact, FaqList } from "@/components/Faq";
import { SizeCompare } from "@/components/HomeSections";
import { cars } from "@/lib/cars";
import { LEAD_TIME } from "@/lib/legal";
import { sizes } from "@/lib/options";
import { abs, pageMeta, SITE_NAME, SITE_URL } from "@/lib/site";

const low = Math.min(...sizes.map((s) => s.price));
const high = Math.max(...sizes.map((s) => s.price));
const demo = cars.find((c) => c.available && c.glb)?.slug;

export const metadata = pageMeta({
  title: "Miniature personnalisée de ta voiture",
  description: `Ta voiture en miniature, fabriquée en pièce unique d'après tes photos : couleur, jantes, modifs. Aperçu 3D gratuit avant de payer. En 1:43, 1:24 ou 1:18, de ${low} à ${high} €.`,
  path: "/miniature",
  image: { url: "/shop/v2/socle-blanc.jpg", width: 1600, height: 1600, alt: "Rendu 3D d'une miniature personnalisée sur son socle blanc" },
});

const structured = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      "@id": `${abs("/miniature")}#product`,
      name: "Miniature personnalisée de ta voiture",
      description: "Miniature de voiture fabriquée en pièce unique d'après les photos du client : couleur, jantes et modifications reproduites. Socle blanc inclus.",
      url: abs("/miniature"),
      image: abs("/shop/v2/socle-blanc.jpg"),
      brand: { "@type": "Brand", name: SITE_NAME },
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "EUR",
        lowPrice: low,
        highPrice: high,
        offerCount: sizes.length,
        availability: "https://schema.org/MadeToOrder",
        seller: { "@id": `${SITE_URL}/#store` },
      },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: abs("/") },
        { "@type": "ListItem", position: 2, name: "La miniature", item: abs("/miniature") },
      ],
    },
  ],
};

const DETAILS: [string, React.ReactNode][] = [
  [
    "Ce qui est inclus",
    <>La miniature de ta voiture, son socle rond blanc, l'aperçu 3D avant fabrication et la livraison standard en France.</>,
  ],
  [
    "Fabrication",
    <>
      Ta voiture est modélisée en 3D d'après tes photos, contrôlée à la main, validée par toi, puis imprimée en 3D, peinte et
      finie. Compte {LEAD_TIME} de fabrication environ, puis le transport.
    </>,
  ],
  [
    "Tailles",
    <>
      {sizes.map((s) => `${s.label} : ${s.length.replace("≈ ", "environ ")} de long, ${s.price} €`).join(" · ")}. De légers
      écarts de détails sont possibles à petite échelle, surtout en 1:43.
    </>,
  ],
  [
    "Livraison",
    <>Offerte en France en livraison standard. L'express et l'envoi hors de France sont payants, leur prix s'affiche au paiement.</>,
  ],
  [
    "Garantie",
    <>
      Abîmée à la livraison ou différente de ta commande : on la refait ou on te rembourse, sans frais. Pièce sur mesure : pas
      de droit de rétractation, d'où l'aperçu à valider avant.
    </>,
  ],
];

export default function MiniaturePage() {
  return (
    <main>
      <JsonLd data={structured} />
      <Nav link={{ href: "#envoi", label: "Recevoir mon aperçu" }} />
      <ProductPage demo={demo} lead={LEAD_TIME} />
      <section className="block faq product-details">
        <h2 className="block-title">Les détails</h2>
        <div className="faq-list">
          {DETAILS.map(([t, d], i) => (
            <details key={t} open={i === 0}>
              <summary>{t}</summary>
              <p>{d}</p>
            </details>
          ))}
        </div>
        <SizeCompare active="1-24" />
      </section>
      <section className="block faq">
        <h2 className="block-title">Questions fréquentes</h2>
        <FaqList ids={["photos", "modifiee", "fidele", "paiement"]} />
        <FaqContact />
      </section>
      <Footer />
    </main>
  );
}
