import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/site";

/*
 * Trois polices, trois rôles :
 * - Geist (moderne) : tout le texte, les titres, les boutons ;
 * - Instrument Serif italique (joli) : le logo, et un seul mot rouge par grand titre, comme le « my » du logo ;
 * - Geist Mono (technique) : petites étiquettes en majuscules (échelle, longueur, numéros), façon plaque gravée.
 */
const sans = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

const description =
  "Transforme ta voiture en miniature unique. Envoie tes photos, personnalise-la en 3D, on la fabrique et on te la livre.";

/** Valeurs par défaut ; chaque page publique fixe les siennes avec pageMeta() (lib/site.ts). */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} · Ta voiture, en miniature`, template: `%s · ${SITE_NAME}` },
  description,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: SITE_NAME,
    title: `${SITE_NAME} · Ta voiture, en miniature`,
    description,
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image" },
  // Balise de validation Google Search Console : à remplir dans Vercel (GOOGLE_SITE_VERIFICATION) si besoin.
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${sans.variable} ${mono.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
