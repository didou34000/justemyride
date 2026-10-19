import type { Metadata } from "next";
import { cars } from "./cars";

/**
 * Adresse publique du site : la seule source pour les URL canoniques, le sitemap, robots.txt et les données
 * structurées. On ne la déduit jamais de l'en-tête Host de la requête.
 * Pour passer sur le domaine définitif (justmyride.shop, une fois acheté et branché), il suffit de mettre
 * NEXT_PUBLIC_SITE_URL dans Vercel puis de redéployer.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://justemyride.vercel.app").replace(/\/+$/, "");

export const SITE_NAME = "JustMyRide";

/** Image de partage par défaut (réseaux sociaux). */
export const OG_IMAGE = { url: "/hero/photo.jpg", width: 1672, height: 941, alt: "Un conducteur photographie sa BMW bleue avec son téléphone" };

/** Adresse absolue d'une page. L'accueil s'écrit sans « / » final, comme Next.js l'écrit dans la balise canonique. */
export const abs = (path: string) => (path === "/" ? SITE_URL : `${SITE_URL}${path}`);

/**
 * Métadonnées complètes d'une page publique : titre, description, canonique et partage social.
 * Next.js remplace l'objet openGraph du layout au lieu de le fusionner : on le reconstruit donc ici en entier.
 */
export function pageMeta({
  title,
  description,
  path,
  image = OG_IMAGE,
}: {
  /** Titre sans la marque : le gabarit du layout ajoute « · JustMyRide » (sauf s'il la contient déjà). */
  title: string;
  description: string;
  path: string;
  image?: { url: string; width: number; height: number; alt: string };
}): Metadata {
  // Un titre qui contient déjà la marque (accueil) n'est pas complété par le gabarit.
  const branded = title.includes(SITE_NAME);
  const full = branded ? title : `${title} · ${SITE_NAME}`;
  return {
    title: branded ? { absolute: title } : title,
    description,
    alternates: { canonical: abs(path) },
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: SITE_NAME,
      url: abs(path),
      title: full,
      description,
      images: [image],
    },
    twitter: { card: "summary_large_image", title: full, description, images: [image.url] },
  };
}

/**
 * Liste blanche des pages proposées aux moteurs (sitemap) : seulement des pages publiques, canoniques et indexables.
 * Pas d'admin, pas d'API, pas de /configurer/sketchfab/<uid> (états internes, noindex),
 * pas de voitures « en préparation » (elles n'ont pas de page à elles).
 */
export const INDEXABLE_PATHS = [
  "/",
  "/envoyer",
  "/configurer",
  ...cars.filter((c) => c.available).map((c) => `/configurer/${c.slug}`),
  "/cgv",
  "/confidentialite",
  "/mentions-legales",
];

/** Données structurées JSON-LD, sérialisées sans risque de fermer la balise <script>. */
export const jsonLd = (data: object) => JSON.stringify(data).replace(/</g, "\\u003c");
