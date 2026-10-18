import type { Metadata } from "next";
import { Instrument_Serif, Inter_Tight } from "next/font/google";
import "./globals.css";
import { SELLER } from "@/lib/legal";

const sans = Inter_Tight({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

const description =
  "Transforme ta voiture en miniature unique. Envoie tes photos, personnalise-la en 3D, on la fabrique et on te la livre.";

export const metadata: Metadata = {
  metadataBase: new URL(SELLER.site),
  title: "JustMyRide — Ta voiture, en miniature",
  description,
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "JustMyRide",
    title: "JustMyRide — Ta voiture, en miniature",
    description,
    images: [{ url: "/hero/photo.jpg", width: 1672, height: 941, alt: "Un conducteur prend sa voiture en photo" }],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
