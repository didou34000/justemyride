// Connexion client (Supabase), lue des deux côtés. Tant que ces deux variables ne sont pas dans Vercel,
// la connexion est éteinte : l'envoi des photos marche comme avant, sans limite d'aperçus.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const authConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Bouton Google affiché seulement quand le fournisseur Google est réglé dans Supabase. */
export const GOOGLE_LOGIN = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";
/** Anti-robot Cloudflare Turnstile sur l'envoi du code (sa clé secrète se règle dans Supabase, pas ici). */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/** Prix de l'aperçu supplémentaire (affichage ; le vrai prix est celui du produit Shopify). */
export const APERCU_PRIX = 5;
