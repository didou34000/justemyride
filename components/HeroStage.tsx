"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ShelfPreview from "./ShelfPreview";
import { colors, ORIGINE, type Config } from "@/lib/options";
import type { Car } from "@/lib/cars";

/*
 * La star de l'accueil : la miniature en 3D, en grand. Elle tourne et change de couleur toute seule
 * jusqu'à ce que le visiteur choisisse une teinte. Un rendu fixe s'affiche le temps que la 3D se charge.
 */
const PAINTS = ["origine", "rouge", "noir", "jaune", "vert-anglais", "blanc", "orange", "violet"];
const AUTO_MS = 3200;

export default function HeroStage({ car }: { car: Car }) {
  const [paint, setPaint] = useState(ORIGINE);
  const [auto, setAuto] = useState(true);
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState(false);
  const photo = useRef<HTMLElement>(null);

  // Variante claire à comparer : ?v=clair (la version « garage de nuit » est celle par défaut).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("v") === "clair") document.querySelector(".hero")?.classList.remove("night");
  }, []);

  // La 3D démarre juste après le premier affichage : le texte et le rendu fixe passent d'abord.
  useEffect(() => {
    const id = window.setTimeout(() => setLive(true), 600);
    return () => window.clearTimeout(id);
  }, []);

  // Couleur suivante toutes les AUTO_MS, tant que personne n'a touché aux pastilles.
  useEffect(() => {
    if (!auto || !ready || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setPaint((p) => PAINTS[(PAINTS.indexOf(p) + 1) % PAINTS.length]), AUTO_MS);
    return () => window.clearInterval(id);
  }, [auto, ready]);

  // Profondeur : la photo du client flotte un peu plus vite que la miniature au défilement.
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (photo.current) photo.current.style.transform = `translate3d(0, ${Math.min(window.scrollY, 600) * -0.12}px, 0)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const tweak = useMemo<Partial<Config>>(() => {
    const col = colors.find((c) => c.id === paint);
    return { paint: col?.hex ?? ORIGINE, paintName: col?.label ?? "D'origine", accessories: ["socle"] };
  }, [paint]);
  const name = colors.find((c) => c.id === paint)?.label ?? "Couleur d'origine";

  return (
    <div className="hero-stage">
      <div className="hs-halo" aria-hidden />
      <div className={`hs-3d ${ready ? "on" : ""}`}>
        {live && <ShelfPreview car={car} tweak={tweak} framing={1.55} onReady={() => setReady(true)} />}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={`hs-poster ${ready ? "off" : ""}`}
        src="/shop/v2/socle-noir.jpg"
        alt="Miniature d'une BMW M140i bleue sur son socle noir gravé"
        width={1600}
        height={1600}
        fetchPriority="high"
      />
      <figure className="hs-photo" ref={photo}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero/photo.jpg" alt="Un conducteur photographie sa BMW bleue avec son téléphone" width={1672} height={941} />
        <figcaption>
          <span className="plate">Ta photo</span>
        </figcaption>
      </figure>
      <div className="hs-picker">
        <span className="hs-name">
          <span className="plate">Couleur</span> {name}
        </span>
        <div className="swatches tight" role="group" aria-label="Changer la couleur de la miniature">
          {PAINTS.map((id) => {
            const col = colors.find((c) => c.id === id);
            return (
              <button
                key={id}
                className={`swatch ${col ? "" : "origin"} ${paint === id ? "on" : ""}`}
                style={col ? { background: col.hex } : undefined}
                aria-label={col?.label ?? "Couleur d'origine"}
                title={col?.label ?? "Couleur d'origine"}
                aria-pressed={paint === id}
                onClick={() => {
                  setAuto(false);
                  setPaint(id);
                }}
              >
                {col ? null : "↺"}
              </button>
            );
          })}
        </div>
        <Link href={`/configurer/${car.slug}`} className="hs-more">
          Jantes, hauteur, vitres… →
        </Link>
      </div>
    </div>
  );
}
