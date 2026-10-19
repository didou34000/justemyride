import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata = { title: "Page introuvable" };

export default function NotFound() {
  return (
    <main>
      <Nav />
      <section className="garage notfound">
        <p className="eyebrow">Erreur 404</p>
        <h1>Cette page a pris la mauvaise sortie.</h1>
        <p className="lead">Elle n'existe pas ou n'existe plus.</p>
        <Link href="/" className="cta">
          Retour à l'accueil
        </Link>
      </section>
      <Footer />
    </main>
  );
}
