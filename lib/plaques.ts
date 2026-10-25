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
};

type Def = {
  label: string;
  hint: string;
  /** Exemple montré tant que le client n'a rien tapé. */
  exemple: string;
  max: number;
  /** Format européen 520 × 110 mm ou américain 305 × 152 mm. */
  format: "eu" | "us";
};

export const PLAQUES: Record<PlaqueStyle, Def> = {
  fr: { label: "France", hint: "Blanche, bandes bleues", exemple: "AB-123-CD", max: 10, format: "eu" },
  "fr-noire": { label: "Noire collection", hint: "Ancienne, lettres argent", exemple: "1234 AB 75", max: 10, format: "eu" },
  de: { label: "Allemagne", hint: "Blanche, bande D", exemple: "M AB 1234", max: 10, format: "eu" },
  uk: { label: "Anglaise", hint: "Jaune, comme à l'arrière", exemple: "AB12 CDE", max: 8, format: "eu" },
  floride: { label: "Floride", hint: "USA, avec l'orange", exemple: "ABC D12", max: 7, format: "us" },
  californie: { label: "Californie", hint: "USA, lettres bleues", exemple: "8ABC123", max: 7, format: "us" },
  aucune: { label: "Pas de plaque", hint: "Pare-chocs nus", exemple: "", max: 0, format: "eu" },
};

export const PLAQUE_STYLES = Object.keys(PLAQUES) as PlaqueStyle[];

/** Ce que le client tape devient un texte de plaque : majuscules, sans accents, rien d'autre que lettres, chiffres, espaces et tirets. */
export function cleanTexte(t: string, style: PlaqueStyle) {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 -]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, PLAQUES[style].max);
}

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
  return p;
}

/** Une ligne pour l'admin et les e-mails, ex. « France · AM-864-BH · 34 ». */
export function plaqueResume(p: Plaque) {
  if (p.style === "aucune") return "Pas de plaque";
  return [PLAQUES[p.style].label, p.texte || "texte non précisé (exemple montré)", p.style === "fr" ? p.dep || "sans département" : ""].filter(Boolean).join(" · ");
}
