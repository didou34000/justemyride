import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Uploader from "@/components/Uploader";
import HeroCollector from "@/components/HeroCollector";
import BrandGrid from "@/components/BrandGrid";
import StickyCta from "@/components/StickyCta";
import Showcase3D from "@/components/Showcase3D";
import { BeforeAfter, Faq, Finishes, HowItWorks, Sizes, TrustBar } from "@/components/HomeSections";
import { cars } from "@/lib/cars";
import { sizes } from "@/lib/options";
import JsonLd from "@/components/JsonLd";
import { SELLER } from "@/lib/legal";
import { abs, pageMeta, SITE_NAME, SITE_URL } from "@/lib/site";

const from = Math.min(...sizes.map((s) => s.price));
const example = cars.find((c) => c.available && c.glb)!;
const heroScale = sizes.find((s) => s.id === "1-24") ?? sizes[0];

export const metadata = pageMeta({
  title: `Miniature personnalisée de ta voiture, d'après tes photos · ${SITE_NAME}`,
  description: `Envoie 8 photos de ta voiture : on la recrée en 3D, tu la personnalises, puis on fabrique sa miniature en pièce unique. En 1:43, 1:24 ou 1:18, dès ${from} €.`,
  path: "/",
});

/** Qui vend (OnlineStore) et quel site (WebSite). Uniquement des infos déjà publiques dans les mentions légales. */
const structured = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "OnlineStore",
      "@id": `${SITE_URL}/#store`,
      name: SITE_NAME,
      url: abs("/"),
      logo: abs("/icon.svg"),
      email: SELLER.email,
      vatID: SELLER.vat,
      description: "Miniatures de voitures personnalisées, fabriquées en pièce unique à partir d'un modèle 3D.",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: abs("/"),
      inLanguage: "fr-FR",
      publisher: { "@id": `${SITE_URL}/#store` },
    },
  ],
};

export default function Home() {
  return (
    <main>
      <JsonLd data={structured} />
      <Nav link={{ href: "#deposer", label: "Envoyer ma voiture" }} />

      <HeroCollector car={example} from={from} scale={heroScale} />
      <TrustBar />
      <Showcase3D car={example} />
      <BrandGrid />
      <BeforeAfter />
      <HowItWorks />
      <Sizes />
      <Finishes />

      <section className="start" id="deposer">
        <h2>
          Ta voiture, 8 photos, <i>on s'occupe du reste.</i>
        </h2>
        <Uploader />
      </section>

      <Faq />

      <Footer />
      <StickyCta from={from} />
    </main>
  );
}
