"use client";

import { useMemo } from "react";
import CarViewer, { type ModelSource } from "./CarViewer";
import { ORIGINE, type Config } from "@/lib/options";
import type { Car } from "@/lib/cars";

/** Miniature d'exemple sur l'accueil : la voiture du catalogue, sur son socle gravé, qui tourne seule. */
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
  return <CarViewer source={source} config={config} framing={1.4} interactive={false} />;
}
