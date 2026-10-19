import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { notFound } from "next/navigation";
import SketchfabModel from "@/components/SketchfabModel";

/**
 * Modèle Sketchfab choisi par le client : un état interne du configurateur (contenu chargé côté navigateur,
 * une adresse par modèle tiers). Utile au client, mais pas une page à proposer aux moteurs de recherche.
 */
export const metadata = { title: "Personnalise ta voiture", robots: { index: false, follow: true } };

export default async function SketchfabPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  // Les identifiants Sketchfab sont 32 caractères hexadécimaux : toute autre adresse est une vraie 404.
  if (!/^[0-9a-f]{32}$/.test(uid)) notFound();
  return (
    <main>
      <Nav link={{ href: "/configurer", label: "Changer de voiture", ghost: true }} />
      <SketchfabModel uid={uid} />
      <Footer />
    </main>
  );
}
