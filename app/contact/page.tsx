import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { SELLER } from "@/lib/legal";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({
  title: "Contact",
  description: "Une question sur ta miniature, une photo, une commande ? Écris directement à la personne qui fabrique les miniatures JustMyRide.",
  path: "/contact",
});

const first = SELLER.name.split(" ")[0];
const mail = (subject: string) => `mailto:${SELLER.email}?subject=${encodeURIComponent(subject)}`;

const reasons = [
  ["Une question avant de commander", "Une photo, une taille, une modif particulière sur ta voiture.", "Question avant commande"],
  ["Ma demande d'aperçu", "Tu as envoyé tes photos et tu veux ajouter quelque chose. Donne le modèle de ta voiture.", "Ma demande d'aperçu"],
  ["Ma commande", "Suivi, livraison, miniature abîmée (avec une photo). Donne ton numéro de commande.", "Ma commande"],
] as const;

export default function ContactPage() {
  return (
    <main>
      <Nav />
      <div className="page">
        <h1>Contact</h1>
        <p className="lead">
          Pas de service client à rallonge : c'est {first}, qui fabrique les miniatures, qui lit et répond à chaque message.
        </p>
        <ul className="contact-list">
          {reasons.map(([t, d, subject]) => (
            <li key={t}>
              <div>
                <b>{t}</b>
                <p>{d}</p>
              </div>
              <a href={mail(subject)} className="cta ghost">
                Écrire
              </a>
            </li>
          ))}
        </ul>
        <p className="contact-mail">
          Ou directement : <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a>
        </p>
        <p className="hint">
          Avant d'écrire, la réponse est peut-être déjà dans les <Link href="/faq" className="link">questions fréquentes</Link>.
        </p>
      </div>
      <Footer />
    </main>
  );
}
