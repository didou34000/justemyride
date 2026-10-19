import Nav from "./Nav";
import Footer from "./Footer";
import { SELLER } from "@/lib/legal";

/** Mise en page commune des pages légales. Le contenu est dans <article> (repris tel quel dans Shopify). */
export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main>
      <Nav />
      <section className="legal">
        <h1>{title}</h1>
        <p className="legal-date">Dernière mise à jour : {SELLER.updated}</p>
        <article>{children}</article>
      </section>
      <Footer />
    </main>
  );
}
