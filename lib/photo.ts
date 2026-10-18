/** Photo privée d'une demande (les chemins commençant par / sont des images publiques, pour l'aperçu). */
export const photoSrc = (pathname: string) =>
  pathname.startsWith("/") ? pathname : `/api/admin/photo?p=${encodeURIComponent(pathname)}`;
