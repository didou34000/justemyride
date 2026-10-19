"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { ModelSource } from "./CarViewer";
import { ORIGINE, type Config } from "@/lib/options";
import type { Car } from "@/lib/cars";

// three.js (≈ 200 ko) n'est plus dans le premier chargement de l'accueil : le texte s'affiche et répond d'abord.
const CarViewer = dynamic(() => import("./CarViewer"), {
  ssr: false,
  loading: () => (
    <div className="viewer">
      <div className="viewer-loading">Chargement du modèle 3D…</div>
    </div>
  ),
});

/** Miniature d'exemple sur l'accueil : la voiture du catalogue, sur son socle gravé. Elle tourne seule, et se fait tourner à la souris ou au doigt (sans zoom, pour ne pas bloquer le défilement). */
export default function ShelfPreview({
  car,
  tweak,
  framing = 1.4,
  onReady,
}: {
  car: Car;
  tweak?: Partial<Config>;
  framing?: number;
  /** Appelé quand le modèle 3D est chargé et affiché. */
  onReady?: () => void;
}) {
  const source = useMemo<ModelSource>(
    () => ({ url: car.glb!, lengthM: car.lengthM, roles: car.roles }),
    [car.glb, car.lengthM, car.roles]
  );
  const config = useMemo<Config>(
    () => ({
      car: car.slug,
      carName: `${car.make} ${car.model}`,
      paint: ORIGINE,
      paintName: "D'origine",
      finish: "metal",
      rims: ORIGINE,
      rimColor: ORIGINE,
      exhaust: ORIGINE,
      caliper: ORIGINE,
      tint: ORIGINE,
      trim: ORIGINE,
      height: ORIGINE,
      size: "1-24",
      accessories: ["socle"],
      ...tweak,
    }),
    [car, tweak]
  );
  return <CarViewer source={source} config={config} framing={framing} zoom={false} onCaps={onReady} />;
}
