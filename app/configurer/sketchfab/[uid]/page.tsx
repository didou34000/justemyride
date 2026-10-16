import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import SketchfabModel from "@/components/SketchfabModel";

export const metadata = { title: "Personnalise ta voiture — JustMyRide" };

export default async function SketchfabPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  return (
    <main>
      <Nav cta={{ href: "/configurer", label: "Changer de voiture" }} />
      <SketchfabModel uid={uid} />
      <Footer />
    </main>
  );
}
