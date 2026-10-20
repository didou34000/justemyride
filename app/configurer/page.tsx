import Image from "next/image";
import Link from "next/link";
import Nav from "@/components/Nav";
import { cars } from "@/lib/cars";
import CarSearch from "@/components/CarSearch";
import Footer from "@/components/Footer";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({
  title: "Le garage : choisis la voiture à faire en miniature",
  description:
    "Les voitures prêtes à personnaliser en 3D : jantes, échappement, couleur, style et taille. Ta voiture n'y est pas ? Envoie tes photos, on la modélise.",
  path: "/configurer",
});

export default function GaragePage() {
  const ready = cars.filter((car) => car.available);
  return (
    <main>
      <Nav />
      <section className="garage">
        <h1>
          Choisis <i>ta</i> voiture
        </h1>
        <p className="lead">Jantes, couleur, toit, bandes, hauteur : tout se règle juste après, en 3D.</p>
        <CarSearch />
        <h3 className="garage-sub">{ready.length > 1 ? "Prêtes à personnaliser" : "Essaie avec celle-ci"}</h3>
        <div className={`garage-grid ${ready.length === 1 ? "solo" : ""}`}>
          {ready.map((car) => (
              <Link key={car.slug} href={`/configurer/${car.slug}`} className="car-card">
                <Image src={car.thumb ?? ""} alt={`Aperçu 3D de la ${car.make} ${car.model}`} width={900} height={450} sizes="(max-width: 860px) 92vw, 560px" priority />
                <div className="car-card-body">
                  <strong>
                    {car.make} {car.model}
                  </strong>
                  <span>{car.years}</span>
                </div>
                <em className="car-card-go">Personnaliser →</em>
              </Link>
            ))}
        </div>
        <p className="hint">Ta voiture n'est pas dans la liste ? <Link href="/envoyer" className="link">Envoie-nous des photos</Link>.</p>
      </section>
      <Footer />
    </main>
  );
}
