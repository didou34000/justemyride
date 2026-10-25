/**
 * Bibliothèque des éléments 3D déjà faits (roues, logos, stickers, ailerons…) : chaque pièce payée une fois chez Meshy
 * ou faite dans Blender reste là, et resert gratuitement dans une autre commande.
 * Partagé entre le serveur (lib/bibliotheque.ts) et la page admin.
 */

export const SORTES = {
  roue: "Roue / jante",
  logo: "Logo / badge",
  sticker: "Sticker",
  aileron: "Aileron",
  carrosserie: "Carrosserie",
  autre: "Autre",
} as const;
export type Sorte = keyof typeof SORTES;
export const isSorte = (s: unknown): s is Sorte => typeof s === "string" && s in SORTES;

export type Element = {
  id: string;
  nom: string;
  sorte: Sorte;
  /** Les voitures qui vont avec (ex. « Mini Cooper Mk1 ») ; vide = va partout. */
  voitures: string[];
  origine: "meshy" | "blender" | "fichier";
  /** Le .glb allégé : chemin du stockage (bibliotheque/…) ou fichier public du site (/bibliotheque/…). */
  glb: string;
  /** Vignette (même règle de chemin). */
  apercu?: string;
  octets?: number;
  /** Crédits Meshy payés pour la faire (0 ou absent : gratuite). */
  credits?: number;
  /** Rappel affiché en rouge : vrai logo de marque, jamais sur une miniature vendue. */
  attention?: string;
  /** Pièce Meshy : la commande et l'essai d'où elle vient (évite de la ranger deux fois). */
  depuis?: { demande: string; job: number };
  /** Pièce fournie avec le site (fichiers dans public/bibliotheque) : modifiable, pas effaçable. */
  fournie?: boolean;
  ajouteLe: string;
};

const LOGO_MARQUE = "Vrai logo de marque : jamais sur une miniature vendue (sélecteur et garage seulement).";

/** Les pièces déjà faites avant la bibliothèque, livrées avec le site (public/bibliotheque). */
export const FOURNIES: Element[] = [
  {
    id: "s-rouge-cooper-s", octets: 18812,
    nom: "S rouge (Cooper S)",
    sorte: "logo",
    voitures: ["Mini Cooper S"],
    origine: "blender",
    attention: "Rappelle le badge Cooper S : à faire valider avant de le poser sur une miniature vendue.",
  },
  { id: "ailes-mini", octets: 19656, nom: "Ailes Mini", sorte: "logo", voitures: ["Mini"], origine: "blender", attention: LOGO_MARQUE },
  { id: "ecriture-cooper", octets: 65148, nom: "Écriture « Cooper »", sorte: "logo", voitures: ["Mini Cooper"], origine: "blender", attention: LOGO_MARQUE },
  { id: "badge-rond-jm", octets: 101868, nom: "Badge rond JM (notre monogramme)", sorte: "logo", voitures: [], origine: "blender" },
  { id: "aileron-m140i", octets: 568240, nom: "Aileron noir brillant", sorte: "aileron", voitures: ["BMW M140i"], origine: "blender" },
  { id: "roue-mini-4-ecrous", octets: 988904, nom: "Roue Mini 4 écrous, jante blanche", sorte: "roue", voitures: ["Mini Cooper Mk1"], origine: "meshy" },
  {
    id: "roue-mini-michelin", octets: 1956304,
    nom: "Roue Mini 8 branches, pneu Michelin, étrier rouge",
    sorte: "roue",
    voitures: ["Mini Cooper"],
    origine: "meshy",
    attention: "Le cache central porte l'écriture MINI : à effacer avant une miniature vendue.",
  },
].map((e) => ({
  ...(e as Omit<Element, "glb" | "ajouteLe">),
  glb: `/bibliotheque/${e.id}.glb`,
  apercu: `/bibliotheque/${e.id}.webp`,
  fournie: true,
  ajouteLe: "2026-10-25T00:00:00.000Z",
}));

/** Devine la sorte d'après le nom donné par le 3e rapport (« roue complète avant », « sticker Castrol »…). */
export function devinerSorte(nom: string, type?: string): Sorte {
  const n = nom.toLowerCase();
  if (type === "sticker" || /sticker|autocollant|d[ée]calque|bande/.test(n)) return "sticker";
  if (/roue|jante|pneu|enjoliveur/.test(n)) return "roue";
  if (/logo|badge|embl[èe]me|monogramme|[ée]criture|lettr/.test(n)) return "logo";
  if (/aileron|spoiler|becquet/.test(n)) return "aileron";
  if (/pare-choc|calandre|capot|r[ée]tro|diffuseur|bas de caisse|[ée]largisseur|prise d'air|ouvrant/.test(n)) return "carrosserie";
  return "autre";
}

const mots = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((m) => m.length > 1);

/**
 * Les éléments de la bibliothèque qui peuvent servir pour une pièce d'une commande, les plus proches d'abord :
 * même sorte obligatoire, puis voiture commune et mots du nom en commun.
 */
export function suggestions(elements: Element[], piece: string, voiture: string, type?: string, max = 6) {
  const sorte = devinerSorte(piece, type);
  const v = new Set(mots(voiture));
  const p = new Set(mots(piece));
  return elements
    .filter((e) => e.sorte === sorte)
    .map((e) => {
      const car = e.voitures.length ? Math.max(0, ...e.voitures.map((x) => mots(x).filter((m) => v.has(m)).length)) : 0.5;
      const nom = mots(e.nom).filter((m) => p.has(m)).length;
      return { e, score: car * 2 + nom };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(({ e }) => e);
}

export const taille = (o?: number) => (o === undefined ? "" : o < 1024 * 1024 ? `${Math.max(1, Math.round(o / 1024))} Ko` : `${(o / 1024 / 1024).toFixed(1)} Mo`);
