export type Option = { id: string; label: string; price?: number };

export const colors = [
  { id: "noir", label: "Noir Minuit", hex: "#0d0e10" },
  { id: "blanc", label: "Blanc Nacré", hex: "#efeee9" },
  { id: "nardo", label: "Gris Nardo", hex: "#8b8e90" },
  { id: "rouge", label: "Rouge Rosso", hex: "#b3121b" },
  { id: "bleu", label: "Bleu Miami", hex: "#1f6fd1" },
  { id: "vert", label: "Vert British", hex: "#1f4d36" },
  { id: "jaune", label: "Jaune Giallo", hex: "#f2c200" },
  { id: "orange", label: "Orange Lava", hex: "#e8590c" },
];

export const finishes: Option[] = [
  { id: "brillant", label: "Brillant" },
  { id: "metal", label: "Métallisé" },
  { id: "mat", label: "Mat" },
];

export const wheelColors = [
  { id: "argent", label: "Argent", hex: "#c9ccd1" },
  { id: "noir", label: "Noir", hex: "#1b1c1f" },
  { id: "bronze", label: "Bronze", hex: "#8c6a3f" },
  { id: "or", label: "Or", hex: "#c9a227" },
];

export const accessories: Option[] = [
  { id: "socle", label: "Socle noir gravé", price: 15 },
  { id: "vitrine", label: "Vitrine acrylique", price: 19 },
];

export const sizes = [
  { id: "1-43", label: "1:43", length: "≈ 10 cm", price: 89 },
  { id: "1-24", label: "1:24", length: "≈ 18 cm", price: 149 },
  { id: "1-18", label: "1:18", length: "≈ 25 cm", price: 219 },
];

export const ORIGINE = "origine";

export const rimStyles: Option[] = [
  { id: ORIGINE, label: "D'origine" },
  { id: "cinq", label: "5 doubles branches" },
  { id: "multi", label: "Multibranches" },
  { id: "turbine", label: "Turbine" },
];

export const exhausts: Option[] = [
  { id: ORIGINE, label: "D'origine" },
  { id: "xl", label: "Grosses sorties" },
  { id: "double", label: "Double sortie" },
  { id: "carree", label: "Sorties carrées" },
];

export const caliperColors = [
  { id: "rouge", label: "Rouge", hex: "#c4161c" },
  { id: "jaune", label: "Jaune", hex: "#f2c200" },
  { id: "bleu", label: "Bleu", hex: "#1f6fd1" },
  { id: "noir", label: "Noir", hex: "#1b1c1f" },
];

/** Une configuration sur une voiture du catalogue. "origine" = on garde la pièce du modèle. */
export type Config = {
  car: string; // slug
  carName: string;
  /** Lien du modèle 3D de base quand il vient de Sketchfab (pour l'usine). */
  source?: string;
  paint: string; // hex ou "origine"
  paintName: string;
  finish: string;
  rims: string;
  rimColor: string; // id de wheelColors ou "origine"
  exhaust: string;
  caliper: string; // id de caliperColors ou "origine"
  size: string;
  accessories: string[];
};

export function priceOf(c: Config): number {
  const size = sizes.find((s) => s.id === c.size)?.price ?? 0;
  const acc = c.accessories.reduce(
    (sum, id) => sum + (accessories.find((a) => a.id === id)?.price ?? 0),
    0
  );
  return size + acc;
}
