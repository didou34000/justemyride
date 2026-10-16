"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import ShelfPreview from "./ShelfPreview";
import type { Car } from "@/lib/cars";

/**
 * Accueil : la photo d'une vraie voiture se fond dans sa miniature 3D au fil du défilement.
 * La progression (0 → 1) est passée au CSS par la variable --p.
 */
export default function HeroReveal({ car, from }: { car: Car; from: number }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
      el.style.setProperty("--p", p.toFixed(3));
      // La miniature se fait tourner dès que la photo est effacée (opacité 0 à p ≈ 0,55, voir globals.css).
      el.classList.toggle("live", p > 0.5);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section className="reveal" ref={ref}>
      <div className="reveal-stick">
        <div className="reveal-mini">
          <ShelfPreview car={car} />
          <div className="reveal-copy dark">
            <h1>En miniature.</h1>
            <div className="reveal-actions">
              <a href="#deposer" className="cta">
                Commencer
              </a>
              <Link href="/configurer" className="arrow-link">
                Voir le garage →
              </Link>
            </div>
            <p className="reveal-price">Dès {from} €</p>
          </div>
        </div>
        <div className="reveal-photo">
          <img src="/hero/photo.jpg" alt="Un conducteur prend sa voiture en photo" />
          <div className="reveal-copy light">
            <h1>Ta voiture.</h1>
          </div>
          <span className="reveal-scroll" aria-hidden>
            ↓
          </span>
        </div>
      </div>
    </section>
  );
}
