import Link from "next/link";
import ShelfPreview from "./ShelfPreview";
import type { Car } from "@/lib/cars";

/** Accueil, premier écran : la promesse, le bouton et le prix tout de suite, la miniature 3D dans son « coffret ». */
export default function HeroCollector({ car, from, scale }: { car: Car; from: number; scale: { label: string; price: number } }) {
  return (
    <section className="hero-c">
      <div className="hero-copy">
        <p className="eyebrow">Atelier de miniatures sur mesure</p>
        <h1>
          Ta voiture,
          <br />
          <i>édition unique.</i>
        </h1>
        <p className="lead">
          Pas un modèle de série : la tienne, avec ses jantes, sa teinte et ses détails. Tu la personnalises en 3D, on la
          fabrique, elle arrive chez toi prête à exposer.
        </p>
        <div className="hero-actions">
          <a href="#deposer" className="cta">
            Commencer ma miniature
          </a>
          <Link href="/configurer" className="cta ghost">
            Le garage
          </Link>
        </div>
        <p className="hero-price">
          Dès <b>{from} €</b> · Livraison offerte en France
        </p>
      </div>

      <figure className="coffret">
        <span className="seal" aria-hidden>
          Pièce
          <br />
          unique
        </span>
        <div className="coffret-stage">
          <ShelfPreview car={car} />
        </div>
        <figcaption className="coffret-label">
          <b>
            {car.make} {car.model}
          </b>
          <span className="coffret-scale">{scale.label}</span>
          <span>Fais-la tourner</span>
          <span>dès {scale.price} €</span>
        </figcaption>
      </figure>
    </section>
  );
}
