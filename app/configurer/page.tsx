import Link from "next/link";
import Nav from "@/components/Nav";
import { cars } from "@/lib/cars";
import CarSearch from "@/components/CarSearch";
import { CarGlyph } from "@/components/Logo";
import { brandLogo } from "@/lib/catalog";
import Footer from "@/components/Footer";

export const metadata = { title: "Choisis ta voiture — JustMyRide" };

export default function GaragePage() {
  return (
    <main>
      <Nav link={{ href: "/#deposer", label: "Envoyer ma voiture" }} />
      <section className="garage">
        <h2>
          Choisis <i>ta</i> voiture
        </h2>
        <p className="lead">Jantes, échappement et couleur se règlent juste après, en 3D.</p>
        <CarSearch />
        <h3 className="garage-sub">Prêtes à personnaliser</h3>
        <div className="garage-grid">
          {cars.map((car) =>
            car.available ? (
              <Link key={car.slug} href={`/configurer/${car.slug}`} className="car-card">
                <img src={car.thumb} alt={`${car.make} ${car.model}`} />
                <div className="car-card-body">
                  <strong>
                    {car.make} {car.model}
                  </strong>
                  <span>{car.years}</span>
                </div>
                <em className="car-card-go">Personnaliser →</em>
              </Link>
            ) : (
              <Link key={car.slug} href="/#deposer" className="car-card soon">
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
        <p className="hint">Ta voiture n'est pas dans la liste ? <Link href="/#deposer" className="link">Envoie-nous des photos</Link>.</p>
      </section>
      <Footer />
    </main>
  );
}
