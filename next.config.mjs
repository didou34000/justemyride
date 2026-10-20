/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Images servies en AVIF ou WebP, à la taille de l'écran.
  images: { formats: ["image/avif", "image/webp"] },
  // L'ancienne page d'envoi est maintenant dans la fiche produit (liens des anciens e-mails compris).
  async redirects() {
    return [{ source: "/envoyer", destination: "/miniature#envoi", permanent: true }];
  },
  // Espace admin et API : jamais indexés, même si un lien y mène (en plus du mot de passe, qui reste la vraie protection).
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/admin", headers: noindex },
      { source: "/admin/:path*", headers: noindex },
      { source: "/api/:path*", headers: noindex },
    ];
  },
};

export default nextConfig;
