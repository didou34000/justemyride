import type { Metadata } from "next";
import Nav from "@/components/Nav";
import AdminDemande from "@/components/AdminDemande";

export const metadata: Metadata = { title: "Demande · JustMyRide", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      <Nav link={{ href: "/", label: "Accueil" }} />
      <AdminDemande id={id} />
    </main>
  );
}
