import Nav from "@/components/Nav";
import SketchfabModel from "@/components/SketchfabModel";

export const metadata = { title: "Personnalise ta voiture — JustMyRide" };

export default async function SketchfabPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  return (
    <main>
      <Nav link={{ href: "/configurer", label: "Changer de voiture" }} />
      <SketchfabModel uid={uid} />
      <footer className="foot">© {new Date().getFullYear()} JustMyRide</footer>
    </main>
  );
}
