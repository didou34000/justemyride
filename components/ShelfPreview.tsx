"use client";

import { useMemo } from "react";
import CarViewer, { type ModelSource } from "./CarViewer";
import { ORIGINE, type Config } from "@/lib/options";
import type { Car } from "@/lib/cars";

/** Miniature d'exemple sur l'accueil : la voiture du catalogue, sur son socle gravé. Elle tourne seule, et se fait tourner à la souris ou au doigt (sans zoom, pour ne pas bloquer le défilement). */
export default function ShelfPreview({ car }: { car: Car }) {
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
      size: "1-24",
      accessories: ["socle"],
    }),
    [car]
  );
  return <CarViewer source={source} config={config} framing={1.4} zoom={false} />;
}
