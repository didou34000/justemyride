/**
 * Catalogue des voitures de base.
 * Chaque modèle 3D est préparé une fois : on note quels matériaux du fichier
 * correspondent à la peinture, aux jantes, aux étriers et à l'échappement.
 * Le configurateur s'appuie uniquement sur ces rôles.
 */
export type Car = {
  slug: string;
  make: string;
  model: string;
  years: string;
  thumb: string;
  available: boolean;
  glb?: string;
  /** Longueur réelle en mètres, pour mettre le modèle à l'échelle. */
  lengthM?: number;
  roles?: {
    paint: string[];
    rims: string[];
    calipers: string[];
    exhaust: string[];
    tyres: string[];
  };
};

export const cars: Car[] = [
  {
    slug: "bmw-m140i",
    make: "BMW",
    model: "M140i",
    years: "2016 – 2019",
    thumb: "/cars/bmw-m140i.jpg",
    available: true,
    glb: "/models/bmw-m140i.glb",
    lengthM: 4.32,
    roles: {
      paint: ["iBody1"],
      rims: ["iRim1"],
      calipers: ["iCalipers1"],
      exhaust: ["iDarkChrome1"],
      tyres: ["iTyres1"],
    },
  },
  { slug: "vw-golf-gti", make: "Volkswagen", model: "Golf GTI", years: "Mk7", thumb: "/guide/avant-gauche.png", available: false },
  { slug: "renault-clio-rs", make: "Renault", model: "Clio RS", years: "IV", thumb: "/guide/avant-gauche.png", available: false },
  { slug: "mini-cooper-s", make: "Mini", model: "Cooper S", years: "F56", thumb: "/guide/avant-gauche.png", available: false },
  { slug: "peugeot-208-gti", make: "Peugeot", model: "208 GTi", years: "2013 – 2019", thumb: "/guide/avant-gauche.png", available: false },
];

export function carBySlug(slug: string) {
  return cars.find((c) => c.slug === slug && c.available);
}
