import { SITE_URL } from "./site";

/**
 * Informations légales du vendeur, utilisées par les mentions légales, les CGV et la politique de confidentialité.
 * Source : registre national des entreprises (fiche Pappers, octobre 2026).
 */
export const SELLER = {
  brand: "JustMyRide",
  name: "Dorian Vuattoux",
  form: "Entrepreneur individuel (micro-entreprise)",
  siren: "940 102 262",
  siret: "940 102 262 00018",
  vat: "FR79940102262",
  address: "163 allée François-Xavier Fabre, 34980 Montferrier-sur-Lez, France",
  email: "dorian.vuattoux@gmail.com",
  /** Obligatoire dans les mentions légales (LCEN) : à renseigner. Vide = ligne masquée. */
  phone: "+33 7 67 37 70 14",
  /** Médiateur de la consommation (obligatoire pour vendre aux particuliers) : nom et site, à renseigner. */
  mediator: null as null | { name: string; url: string },
  /** Franchise en base de TVA (art. 293 B du CGI) : confirmé le 18 octobre 2026. */
  vatFranchise: true,
  /** Adresse publique : voir lib/site.ts (variable NEXT_PUBLIC_SITE_URL). */
  site: SITE_URL,
  updated: "19 octobre 2026",
};

export const HOST = {
  name: "Vercel Inc.",
  address: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
  url: "https://vercel.com",
};

/** Délai de fabrication annoncé, après validation du modèle 3D par le client. */
export const LEAD_TIME = "2 à 3 semaines";
