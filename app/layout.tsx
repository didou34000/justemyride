import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JustMyRide — Ta voiture, en miniature",
  description:
    "Transforme ta voiture en miniature unique. Envoie tes photos, personnalise, on s'occupe du reste.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
