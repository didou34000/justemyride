"use client";

import { useEffect, useRef, useState } from "react";
import ShelfPreview from "./ShelfPreview";
import type { Car } from "@/lib/cars";

/**
 * Accueil : trois voitures très différentes, en 3D, pour montrer qu'on refait n'importe quelle voiture.
 * La BMW est notre modèle préparé ; la SF90 et la 2CV sont des modèles Sketchfab (CC BY) montrés dans leur lecteur,
 * jamais téléchargés. Les lecteurs ne se chargent qu'une fois la section à l'écran.
 */
const SKETCHFAB = [
  {
    id: "sf90",
    name: "Ferrari SF90",
    uid: "26f20b26a76341089ac81a7a61a94d1a",
    credit: "NazhDesign",
  },
  {
    id: "2cv",
    name: "Citroën 2CV",
    uid: "abdb2d11268b405c90b117e0992693ee",
    credit: "pagesm",
  },
];

const embed = (uid: string) =>
  `https://sketchfab.com/models/${uid}/embed?autostart=1&autospin=0.3&ui_theme=dark&ui_infos=0&ui_watermark=0&ui_help=0&ui_settings=0&ui_vr=0&ui_ar=0&ui_inspector=0&ui_annotations=0&ui_controls=0&ui_stop=0&preload=1&transparent=1`;

export default function Showcase3D({ car }: { car: Car }) {
  const tabs = [...SKETCHFAB.map((s) => ({ id: s.id, name: s.name })), { id: "bmw", name: `${car.make} ${car.model}` }];
  const [cur, setCur] = useState(tabs[0].id);
  const [seen, setSeen] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const sf = SKETCHFAB.find((s) => s.id === cur);

  return (
    <section className="home-block show3d" ref={ref}>
      <h2>
        N'importe quelle voiture. <i>Recréée en 3D.</i>
      </h2>
      <div className="show3d-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={cur === t.id} className={cur === t.id ? "on" : ""} onClick={() => setCur(t.id)}>
            {t.name}
          </button>
        ))}
      </div>
      <div className="show3d-stage">
        {seen && sf && <iframe key={sf.uid} title={sf.name} src={embed(sf.uid)} allow="autoplay; fullscreen; xr-spatial-tracking" />}
        {seen && cur === "bmw" && <ShelfPreview car={car} />}
        <span className="show3d-hint">Fais-la tourner</span>
      </div>
      {sf && (
        <p className="show3d-credit">
          Modèle 3D : {sf.credit}, licence CC BY, via Sketchfab.
        </p>
      )}
    </section>
  );
}
