/**
 * Plaques d'immatriculation au choix du client (étape « Ta plaque » du formulaire).
 * Le même choix sert à l'aperçu sur le site (components/PlatePreview.tsx) et à la vraie plaque 3D
 * faite dans Blender (tools/plaque.py, mêmes styles et mêmes couleurs).
 */

export type PlaqueStyle = "fr" | "fr-noire" | "de" | "uk" | "floride" | "californie" | "aucune";

export type Plaque = {
  style: PlaqueStyle;
  /** Le texte voulu, en majuscules (lettres, chiffres, espaces et tirets). */
  texte?: string;
  /** Plaque française : le numéro de département de la bande de droite. */
  dep?: string;
  /** Couleurs choisies par le client (hex #rrggbb) ; absentes = celles du style. */
  couleurs?: Couleurs;
};

export type Couleurs = { fond?: string; texte?: string; bande?: string };

type Def = {
  label: string;
  hint: string;
  /** Exemple montré tant que le client n'a rien tapé. */
  exemple: string;
  max: number;
  /** Format européen 520 × 110 mm ou américain 305 × 152 mm. */
  format: "eu" | "us";
  /** Couleurs d'origine du style ; `bande` seulement pour les plaques à bandes bleues. */
  couleurs: Required<Pick<Couleurs, "fond" | "texte">> & { bande?: string };
};

export const PLAQUES: Record<PlaqueStyle, Def> = {
  fr: { label: "France", hint: "Blanche, bandes bleues", exemple: "AB-123-CD", max: 12, format: "eu", couleurs: { fond: "#fbfbf9", texte: "#111111", bande: "#0b2a8c" } },
  "fr-noire": { label: "Noire collection", hint: "Ancienne, lettres argent", exemple: "1234 AB 75", max: 12, format: "eu", couleurs: { fond: "#111111", texte: "#d9d9d6" } },
  de: { label: "Allemagne", hint: "Blanche, bande D", exemple: "M AB 1234", max: 12, format: "eu", couleurs: { fond: "#fbfbf9", texte: "#111111", bande: "#0b2a8c" } },
  uk: { label: "Anglaise", hint: "Jaune, comme à l'arrière", exemple: "AB12 CDE", max: 12, format: "eu", couleurs: { fond: "#f6c800", texte: "#111111" } },
  floride: { label: "Floride", hint: "USA, avec l'orange", exemple: "ABC D12", max: 8, format: "us", couleurs: { fond: "#fbfbf7", texte: "#0d6b3a" } },
  californie: { label: "Californie", hint: "USA, lettres bleues", exemple: "8ABC123", max: 8, format: "us", couleurs: { fond: "#fbfbf7", texte: "#1d2f6f" } },
  aucune: { label: "Pas de plaque", hint: "Pare-chocs nus", exemple: "", max: 0, format: "eu", couleurs: { fond: "#ffffff", texte: "#111111" } },
};

export const PLAQUE_STYLES = Object.keys(PLAQUES) as PlaqueStyle[];

/** Le plus long texte accepté, quel que soit le style (le texte est gardé quand on change de style). */
export const MAX_TEXTE = 12;

/** Ce que le client tape devient un texte de plaque : majuscules, sans accents, rien d'autre que lettres, chiffres, espaces et tirets. */
export function cleanTexte(t: string, style: PlaqueStyle) {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 -]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, PLAQUES[style].max || MAX_TEXTE);
}

const HEX = /^#[0-9a-f]{6}$/;
export const isHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v.toLowerCase());

/** Les couleurs réellement utilisées : celles du client, sinon celles du style. */
export function couleursPlaque(p: Plaque) {
  const d = PLAQUES[p.style].couleurs;
  const c = p.couleurs ?? {};
  return {
    fond: isHex(c.fond) ? c.fond.toLowerCase() : d.fond,
    texte: isHex(c.texte) ? c.texte.toLowerCase() : d.texte,
    bande: d.bande ? (isHex(c.bande) ? c.bande.toLowerCase() : d.bande) : undefined,
  };
}

/** Couleurs proposées en un clic ; le sélecteur libre permet toutes les autres. */
export const TEINTES = ["#fbfbf9", "#111111", "#f6c800", "#d9d9d6", "#c8102e", "#0b2a8c", "#0d6b3a", "#1d2f6f", "#f28c1b", "#7a7f87", "#e85d9b", "#5fb4e6"];

export const cleanDep = (d: string) => d.toUpperCase().replace(/[^0-9AB]/g, "").slice(0, 3);

/**
 * Le texte réellement imprimé : celui du client coupé à la longueur du style, ou l'exemple s'il n'a rien mis.
 * Le texte tapé est gardé tel quel quand on change de style : repasser d'Anglaise à France ne perd rien.
 */
export const texteAffiche = (p: Plaque) => cleanTexte(p.texte ?? "", p.style).trim() || PLAQUES[p.style].exemple;

/** Vérifie une plaque reçue par l'API ; renvoie null si elle n'est pas valable. */
export function parsePlaque(v: unknown): Plaque | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.style !== "string" || !(o.style in PLAQUES)) return null;
  const style = o.style as PlaqueStyle;
  if (style === "aucune") return { style };
  const texte = typeof o.texte === "string" ? cleanTexte(o.texte, style).trim() : "";
  const p: Plaque = { style, ...(texte ? { texte } : {}) };
  if (style === "fr" && typeof o.dep === "string" && cleanDep(o.dep)) p.dep = cleanDep(o.dep);
  // On ne garde que les couleurs qui diffèrent du style.
  const c = (o.couleurs && typeof o.couleurs === "object" ? o.couleurs : {}) as Record<string, unknown>;
  const d = PLAQUES[style].couleurs;
  const couleurs: Couleurs = {};
  for (const k of ["fond", "texte", "bande"] as const) {
    const v = c[k];
    if (isHex(v) && (k !== "bande" || d.bande) && v.toLowerCase() !== d[k]) couleurs[k] = v.toLowerCase();
  }
  if (Object.keys(couleurs).length) p.couleurs = couleurs;
  return p;
}

/** Une ligne pour l'admin et les e-mails, ex. « France · AM-864-BH · 34 ». */
export function plaqueResume(p: Plaque) {
  if (p.style === "aucune") return "Pas de plaque";
  const c = p.couleurs ?? {};
  const perso = [c.fond && `fond ${c.fond}`, c.texte && `texte ${c.texte}`, c.bande && `bandes ${c.bande}`].filter(Boolean).join(", ");
  return [PLAQUES[p.style].label, p.texte || "texte non précisé (exemple montré)", p.style === "fr" ? p.dep || "sans département" : "", perso && `couleurs : ${perso}`]
    .filter(Boolean)
    .join(" · ");
}

/** Les arguments de tools/plaque.py pour refaire exactement cette plaque dans Blender. */
export function plaqueArgs(p: Plaque) {
  const c = couleursPlaque(p);
  const a = [`--style ${p.style}`, `--texte "${texteAffiche(p)}"`];
  if (p.style === "fr" && p.dep) a.push(`--dep ${p.dep}`);
  if (p.couleurs?.fond) a.push(`--fond "${c.fond}"`);
  if (p.couleurs?.texte) a.push(`--encre "${c.texte}"`);
  if (p.couleurs?.bande && c.bande) a.push(`--bande "${c.bande}"`);
  return a.join(" ");
}
