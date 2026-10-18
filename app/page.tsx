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

const from = Math.min(...sizes.map((s) => s.price));
const example = cars.find((c) => c.available && c.glb)!;
const heroScale = sizes.find((s) => s.id === "1-24") ?? sizes[0];

export default function Home() {
  return (
    <main>
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
