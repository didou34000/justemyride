import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SELLER } from "@/lib/legal";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

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
    <html lang="fr" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
