export type Option = { id: string; label: string; price?: number };

/** Teintes proposées, par famille. Noms génériques : pas de nom commercial de constructeur. */
export const colorGroups = [
  {
    label: "Classiques",
    list: [
      { id: "noir", label: "Noir profond", hex: "#0d0e10" },
      { id: "blanc", label: "Blanc nacré", hex: "#efeee9" },
      { id: "argent", label: "Argent", hex: "#b9bcc1" },
      { id: "nardo", label: "Gris ciment", hex: "#8b8e90" },
      { id: "anthracite", label: "Gris anthracite", hex: "#3a3d42" },
    ],
  },
  {
    label: "Sportives",
    list: [
      { id: "rouge", label: "Rouge course", hex: "#b3121b" },
      { id: "bleu", label: "Bleu électrique", hex: "#1f6fd1" },
      { id: "bleu-nuit", label: "Bleu nuit", hex: "#14264f" },
      { id: "jaune", label: "Jaune vif", hex: "#f2c200" },
      { id: "orange", label: "Orange lave", hex: "#e8590c" },
      { id: "vert-anglais", label: "Vert anglais", hex: "#1f4d36" },
      { id: "vert-lime", label: "Vert acide", hex: "#7cc11f" },
    ],
  },
  {
    label: "Originales",
    list: [
      { id: "violet", label: "Violet profond", hex: "#4b2a6b" },
      { id: "bordeaux", label: "Bordeaux", hex: "#5a1420" },
      { id: "sable", label: "Beige sable", hex: "#c9b38c" },
      { id: "olive", label: "Vert olive", hex: "#5d6340" },
      { id: "pastel", label: "Bleu pastel", hex: "#9cc4dd" },
      { id: "rose", label: "Rose poudré", hex: "#d9a0a8" },
    ],
  },
];
export const colors = colorGroups.flatMap((g) => g.list);

export const finishes: Option[] = [
  { id: "brillant", label: "Brillant" },
  { id: "metal", label: "Métallisé" },
  { id: "satin", label: "Satiné" },
  { id: "mat", label: "Mat" },
];

export const tints = [
  { id: "origine", label: "D'origine", level: 0 },
  { id: "legere", label: "Légère", level: 0.6 },
  { id: "foncee", label: "Foncée", level: 0.82 },
  { id: "limo", label: "Très foncée", level: 0.95 },
];

export const trims: Option[] = [
  { id: "origine", label: "Chromes d'origine" },
  { id: "noir", label: "Chromes noirs" },
];

/** Rabaissement de la caisse, en millimètres à l'échelle de la vraie voiture. */
export const heights = [
  { id: "origine", label: "D'origine", mm: 0 },
  { id: "sport", label: "Rabaissée", mm: 30 },
  { id: "basse", label: "Très basse", mm: 55 },
];

export const wheelColors = [
  { id: "argent", label: "Argent", hex: "#c9ccd1" },
  { id: "noir", label: "Noir", hex: "#1b1c1f" },
  { id: "bronze", label: "Bronze", hex: "#8c6a3f" },
  { id: "or", label: "Or", hex: "#c9a227" },
  { id: "gun", label: "Gris canon", hex: "#4a4d52" },
  { id: "blanc", label: "Blanc", hex: "#eceae4" },
  { id: "rouge", label: "Rouge", hex: "#a8141c" },
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
  { id: "orange", label: "Orange", hex: "#e8590c" },
  { id: "vert", label: "Vert", hex: "#3f9a3a" },
  { id: "argent", label: "Argent", hex: "#c9ccd1" },
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
  /** Pièces Sketchfab choisies : nom + lien, pour l'usine. */
  rimPart?: string;
  exhaustPart?: string;
  caliper: string; // id de caliperColors ou "origine"
  tint: string; // id de tints
  trim: string; // id de trims
  height: string; // id de heights
  /** Texte gravé sur la plaque du socle noir (facultatif). */
  engraving?: string;
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
