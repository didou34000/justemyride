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
  /** Monogramme affiché sur la tuile (pas de logo officiel : marques déposées). */
  mark: string;
  models: CarModel[];
};

export const brands: Brand[] = [
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
    ["volkswagen", "Volkswagen", "VW"],
    ["renault", "Renault", "R"],
    ["peugeot", "Peugeot", "P"],
    ["audi", "Audi", "A"],
    ["mercedes", "Mercedes", "MB"],
    ["porsche", "Porsche", "P"],
    ["toyota", "Toyota", "T"],
    ["honda", "Honda", "H"],
    ["subaru", "Subaru", "S"],
    ["nissan", "Nissan", "N"],
    ["citroen", "Citroën", "C"],
    ["ford", "Ford", "F"],
  ].map(([id, name, mark]) => ({ id, name, mark, models: [] })),
];

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
