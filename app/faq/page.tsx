import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { FaqContact, FaqList, QUESTIONS } from "@/components/Faq";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({
  title: "Questions fréquentes",
  description: "Photos à envoyer, aperçu 3D gratuit, tailles, délais, livraison, paiement, garantie : toutes les réponses sur les miniatures personnalisées JustMyRide.",
  path: "/faq",
});

const topics = [...new Set(QUESTIONS.map((q) => q.topic))];

export default function FaqPage() {
  return (
    <main>
      <Nav />
      <div className="page faq">
        <h1>Questions fréquentes</h1>
        <p className="lead">Tout ce qu'on nous demande avant de commander. Il manque ta question ? Écris-moi.</p>
        {topics.map((t) => (
          <section key={t} className="faq-topic">
            <h2>{t}</h2>
            <FaqList ids={QUESTIONS.filter((q) => q.topic === t).map((q) => q.id)} />
          </section>
        ))}
        <FaqContact />
        <Link href="/miniature" className="cta">
          Créer ma miniature
        </Link>
      </div>
      <Footer />
    </main>
  );
}
