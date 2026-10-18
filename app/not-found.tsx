import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata = { title: "Page introuvable — JustMyRide" };

export default function NotFound() {
  return (
    <main>
      <Nav link={{ href: "/configurer", label: "Le garage" }} />
      <section className="garage notfound">
        <p className="eyebrow">Erreur 404</p>
        <h2>Cette page a pris la mauvaise sortie.</h2>
        <p className="lead">Elle n'existe pas ou n'existe plus.</p>
        <Link href="/" className="cta">
          Retour à l'accueil
        </Link>
      </section>
      <Footer />
    </main>
  );
}
