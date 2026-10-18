/**
 * Annuaire du parcours client : marque → modèle → génération (années) → modèle 3D de base.
 * Chaque génération pointe vers un modèle Sketchfab choisi à la main (licence qui autorise la vente),
 * ou vers une voiture déjà préparée du garage (lib/cars.ts).
 * Sans modèle retenu, le client passe par la recherche libre.
 * Sources et réserves : docs/annuaire/mini.md.
 */
export type Generation = {
  id: string;
  label: string;
  years: string;
  /** Repère visible pour aider le client à reconnaître sa génération. */
  hint?: string;
  /** Modèle Sketchfab retenu pour cette génération. */
  uid?: string;
  /** Ou une voiture déjà préparée du garage (slug de lib/cars.ts). */
  car?: string;
};

export type CarModel = { id: string; name: string; generations: Generation[] };

export type Brand = {
  id: string;
  name: string;
  /** Initiales affichées si le logo manque. */
  mark: string;
  models: CarModel[];
};

const allBrands: Brand[] = [
  {
    id: "mini",
    name: "Mini",
    mark: "MINI",
    models: [
      {
        id: "3-portes",
        name: "Mini 3 portes (One, Cooper, Cooper S, JCW)",
        generations: [
          {
            id: "r50-r53",
            label: "R50 / R53",
            years: "2001 – 2006",
            hint: "Clignotants ronds séparés dans le pare-chocs. Cooper S : prise d'air sur le capot, échappement double au centre.",
            uid: "63ca99a0ca064af0a5d2298997875f1d",
          },
          {
            id: "r56",
            label: "R56",
            years: "2006 – 2014",
            hint: "Clignotants intégrés dans les phares, capot plus haut.",
            uid: "1b628ba826f04ba79823ef62dccaa0df",
          },
          {
            id: "f56",
            label: "F56",
            years: "2014 – 2024",
            hint: "Grande calandre qui descend dans le pare-chocs, phares à anneau LED.",
            uid: "a719330d72604ad1b9fbacc543a3b637",
          },
          {
            id: "f66",
            label: "F66 / J01",
            years: "depuis 2024",
            hint: "Calandre octogonale lisse, phares sans entourage chromé.",
          },
        ],
      },
      {
        id: "cabrio",
        name: "Mini Cabrio",
        generations: [
          { id: "r52", label: "R52", years: "2004 – 2008", hint: "Même face avant que la R50 / R53." },
          { id: "r57", label: "R57", years: "2009 – 2015", uid: "ebe3bf9e2f6a4dd1b45b2822ef90805b" },
          { id: "f57", label: "F57", years: "2016 – 2024", uid: "e0e5690799bb49fdb13aaaa3abf4225e" },
        ],
      },
      {
        id: "clubman",
        name: "Mini Clubman",
        generations: [
          { id: "r55", label: "R55", years: "2007 – 2014", uid: "df8879b06e0b4baebfb648f4c13b3bfa" },
          { id: "f54", label: "F54", years: "2015 – 2024", uid: "ac7bb4e4748f4961b8ce4c6259bd7ddf" },
        ],
      },
      {
        id: "classique",
        name: "Mini classique",
        generations: [{ id: "mk1-mk7", label: "Mk1 à Mk7", years: "1959 – 2000", uid: "34651008e7074c03ab3aa7e1795dbd00" }],
      },
    ],
  },
  {
    id: "bmw",
    name: "BMW",
    mark: "BMW",
    models: [
      {
        id: "serie-1",
        name: "Série 1",
        generations: [{ id: "f20", label: "F20 / F21 (M140i)", years: "2016 – 2019", car: "bmw-m140i" }],
      },
    ],
  },
  // Marques sans annuaire pour l'instant : le client passe directement par la recherche libre.
  ...[
    ["ferrari", "Ferrari", "F"],
    ["lamborghini", "Lamborghini", "L"],
    ["porsche", "Porsche", "P"],
    ["koenigsegg", "Koenigsegg", "K"],
    ["mclaren", "McLaren", "M"],
    ["bugatti", "Bugatti", "B"],
    ["pagani", "Pagani", "P"],
    ["aston-martin", "Aston Martin", "AM"],
    ["mercedes", "Mercedes", "MB"],
    ["audi", "Audi", "A"],
    ["volkswagen", "Volkswagen", "VW"],
    ["renault", "Renault", "R"],
    ["peugeot", "Peugeot", "P"],
    ["citroen", "Citroën", "C"],
    ["alpine", "Alpine", "A"],
    ["toyota", "Toyota", "T"],
    ["nissan", "Nissan", "N"],
    ["honda", "Honda", "H"],
    ["subaru", "Subaru", "S"],
    ["tesla", "Tesla", "T"],
    ["ford", "Ford", "F"],
    ["maserati", "Maserati", "M"],
    ["alfa-romeo", "Alfa Romeo", "AR"],
    ["bentley", "Bentley", "B"],
    ["rolls-royce", "Rolls-Royce", "RR"],
    ["lotus", "Lotus", "L"],
    ["jaguar", "Jaguar", "J"],
    ["land-rover", "Land Rover", "LR"],
    ["rimac", "Rimac", "R"],
    ["abarth", "Abarth", "A"],
    ["fiat", "Fiat", "F"],
    ["lancia", "Lancia", "L"],
    ["seat", "Seat", "S"],
    ["cupra", "Cupra", "C"],
    ["skoda", "Škoda", "Š"],
    ["ds", "DS", "DS"],
    ["dacia", "Dacia", "D"],
    ["opel", "Opel", "O"],
    ["volvo", "Volvo", "V"],
    ["kia", "Kia", "K"],
    ["hyundai", "Hyundai", "H"],
    ["mazda", "Mazda", "M"],
    ["mitsubishi", "Mitsubishi", "M"],
    ["suzuki", "Suzuki", "S"],
    ["lexus", "Lexus", "L"],
    ["jeep", "Jeep", "J"],
  ].map(([id, name, mark]) => ({ id, name, mark, models: [] })),
];

/** Ordre d'affichage : les marques qui font rêver d'abord, puis les plus courantes en France. */
const ORDER = "ferrari lamborghini porsche bmw mercedes audi koenigsegg mclaren bugatti aston-martin pagani mini volkswagen renault peugeot citroen alpine toyota nissan honda subaru tesla ford".split(" ");
const rank = (id: string) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);
export const brands: Brand[] = [...allBrands].sort((a, b) => rank(a.id) - rank(b.id));

/**
 * Logo officiel de la marque, affiché seulement pour que le client reconnaisse sa marque
 * (sélecteur et garage). Jamais sur les rendus des miniatures ni dans la publicité :
 * voir juridique-logos-et-formes.md. Fichiers dans public/brands/.
 */
const LOGOS = new Set(
  "mini bmw volkswagen renault peugeot audi mercedes porsche toyota honda subaru nissan citroen ford ferrari lamborghini koenigsegg mclaren bugatti pagani aston-martin bentley rolls-royce maserati alfa-romeo alpine lotus tesla land-rover jeep fiat seat cupra skoda kia hyundai mazda volvo dacia opel ds lexus mitsubishi suzuki abarth jaguar lancia rimac".split(" ")
);

export function brandLogo(nameOrId: string): string | undefined {
  const id = nameOrId
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]+/g, "-")
    .replace(/^-|-$/g, "");
  const key = id === "vw" ? "volkswagen" : id.startsWith("mercedes") ? "mercedes" : id;
  return LOGOS.has(key) ? `/brands/${key}.png` : undefined;
}

/** Ce que le client a choisi comme base, envoyé avec ses photos. */
export type Base = {
  label: string;
  brand?: string;
  model?: string;
  generation?: string;
  years?: string;
  uid?: string;
  car?: string;
  /** "annuaire", "recherche" (choisi dans la recherche libre) ou "aucune" (pas trouvé). */
  source: "annuaire" | "recherche" | "aucune";
};
