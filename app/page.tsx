import Link from "next/link";
import Nav from "@/components/Nav";
import Uploader from "@/components/Uploader";
import HeroReveal from "@/components/HeroReveal";
import { cars } from "@/lib/cars";
import { sizes } from "@/lib/options";

const from = Math.min(...sizes.map((s) => s.price));
const example = cars.find((c) => c.available && c.glb)!;

export default function Home() {
  return (
    <main>
      <Nav link={{ href: "/configurer", label: "Le garage" }} />

      <HeroReveal car={example} from={from} />

      <section className="start" id="deposer">
        <h2>Ta voiture, 8 photos, on s'occupe du reste.</h2>
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
