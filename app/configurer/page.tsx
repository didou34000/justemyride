import Link from "next/link";
import Nav from "@/components/Nav";
import { cars } from "@/lib/cars";
import CarSearch from "@/components/CarSearch";
import { CarGlyph } from "@/components/Logo";
import { brandLogo } from "@/lib/catalog";
import Footer from "@/components/Footer";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({
  title: "Le garage : choisis la voiture à faire en miniature",
  description:
    "Les voitures prêtes à personnaliser en 3D (jantes, échappement, couleur, taille) et celles en préparation. Ta voiture n'y est pas ? Envoie tes photos, on la modélise.",
  path: "/configurer",
});

export default function GaragePage() {
  return (
    <main>
      <Nav />
      <section className="garage">
        <h1>
          Choisis <i>ta</i> voiture
        </h1>
        <p className="lead">Jantes, échappement et couleur se règlent juste après, en 3D.</p>
        <CarSearch />
        <h3 className="garage-sub">Prêtes à personnaliser</h3>
        <div className="garage-grid">
          {cars.map((car) =>
            car.available ? (
              <Link key={car.slug} href={`/configurer/${car.slug}`} className="car-card">
                <img src={car.thumb} alt={`Aperçu 3D de la ${car.make} ${car.model}`} width={900} height={450} />
                <div className="car-card-body">
                  <strong>
                    {car.make} {car.model}
                  </strong>
                  <span>{car.years}</span>
                </div>
                <em className="car-card-go">Personnaliser →</em>
              </Link>
            ) : (
              <Link key={car.slug} href="/envoyer" className="car-card soon">
                <div className="noimg soon-mark">
                  {brandLogo(car.make) ? <img src={brandLogo(car.make)} alt="" /> : <CarGlyph size={56} />}
                </div>
                <div className="car-card-body">
                  <strong>
                    {car.make} {car.model}
                  </strong>
                  <span>{car.years} · en préparation</span>
                </div>
                <em className="car-card-go">Demander ce modèle</em>
              </Link>
            )
          )}
        </div>
        <p className="hint">Ta voiture n'est pas dans la liste ? <Link href="/envoyer" className="link">Envoie-nous des photos</Link>.</p>
      </section>
      <Footer />
    </main>
  );
}
