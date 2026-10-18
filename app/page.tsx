import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Uploader from "@/components/Uploader";
import HeroReveal from "@/components/HeroReveal";
import { Faq, Finishes, HowItWorks, Sizes, TrustBar } from "@/components/HomeSections";
import { cars } from "@/lib/cars";
import { sizes } from "@/lib/options";

const from = Math.min(...sizes.map((s) => s.price));
const example = cars.find((c) => c.available && c.glb)!;

export default function Home() {
  return (
    <main>
      <Nav link={{ href: "/configurer", label: "Le garage" }} />

      <HeroReveal car={example} from={from} />
      <TrustBar />
      <HowItWorks />
      <Sizes />
      <Finishes />

      <section className="start" id="deposer">
        <h2>Ta voiture, 8 photos, on s'occupe du reste.</h2>
        <Uploader />
      </section>

      <Faq />

      <Footer />
    </main>
  );
}
