import Link from "next/link";
import ShelfPreview from "./ShelfPreview";
import type { Car } from "@/lib/cars";

/** Accueil, premier écran : la promesse, le bouton et le prix tout de suite, la miniature 3D dans son « coffret ». */
export default function HeroCollector({ car, from, scale }: { car: Car; from: number; scale: { label: string; price: number } }) {
  return (
    <section className="hero-c">
      <div className="hero-copy">
        <h1>
          Ta voiture,
          <br />
          <i>édition unique.</i>
        </h1>
        <p className="lead">Pas un modèle de série : la tienne, recréée en 3D puis fabriquée en miniature.</p>
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
        </figcaption>
      </figure>
    </section>
  );
}
