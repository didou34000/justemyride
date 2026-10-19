import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * /admin n'est pas bloqué ici exprès : bloqué, Google ne lirait jamais son « noindex » et pourrait garder l'adresse
 * seule dans son index. L'admin est protégé par mot de passe et renvoie noindex (balise + en-tête X-Robots-Tag).
 * Les API ne servent à aucune page publique au premier affichage : on évite d'y envoyer les robots.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
