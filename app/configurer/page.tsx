import Link from "next/link";
import Nav from "@/components/Nav";
import { cars } from "@/lib/cars";
import CarSearch from "@/components/CarSearch";

export const metadata = { title: "Choisis ta voiture — JustMyRide" };

export default function GaragePage() {
  return (
    <main>
      <Nav link={{ href: "/#deposer", label: "Envoyer ma voiture" }} />
      <section className="garage">
        <p className="eyebrow">Étape 1 · La base</p>
        <h2>Choisis ta voiture</h2>
        <p className="lead">
          Tu choisis ici seulement le modèle de base. Jantes, échappement et couleur se règlent à l'étape suivante, sur
          ta miniature en 3D.
        </p>
        <CarSearch />
        <p className="eyebrow garage-sub">Prêtes à personnaliser</p>
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
                <img src={car.thumb} alt="" />
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
      <footer className="foot"><span>© {new Date().getFullYear()} JustMyRide</span></footer>
    </main>
  );
}
