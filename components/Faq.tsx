import Link from "next/link";
import { LEAD_TIME, SELLER } from "@/lib/legal";
import { sizes } from "@/lib/options";

/*
 * Toutes les questions du site, au même endroit : l'accueil et la fiche produit en montrent quelques-unes,
 * la page /faq les montre toutes. Chaque réponse doit rester vraie et cohérente avec les CGV et Shopify.
 */
type QA = { id: string; q: string; a: React.ReactNode; topic: "Commande" | "Fabrication" | "Livraison et paiement" };

export const QUESTIONS: QA[] = [
  {
    id: "photos",
    topic: "Commande",
    q: "Combien de photos faut-il ?",
    a: (
      <>
        Au minimum 2 : un trois quarts avant et un trois quarts arrière. Il n'y a pas de maximum : profil, face, arrière,
        jantes, gros plans des modifs (kit, aileron, autocollants)… Plus on en a, plus la miniature est fidèle.
      </>
    ),
  },
  {
    id: "engagement",
    topic: "Commande",
    q: "Ça m'engage à quelque chose d'envoyer mes photos ?",
    a: <>Non. L'envoi et l'aperçu 3D sont gratuits. Tu ne paies que si tu commandes ta miniature.</>,
  },
  {
    id: "modifiee",
    topic: "Commande",
    q: "Ma voiture est modifiée ou rare, c'est possible ?",
    a: (
      <>
        Oui, c'est justement le principe : on part de tes photos, pas d'un catalogue. Jantes, kit carrosserie, aileron,
        teinte spéciale… Montre bien chaque modification en photo.
      </>
    ),
  },
  {
    id: "taille",
    topic: "Commande",
    q: "Quelle taille choisir ?",
    a: (
      <>
        {sizes.map((s, i) => (
          <span key={s.id}>
            {i > 0 && ", "}
            {s.label} : {s.length.replace("≈ ", "environ ")} ({s.price} €)
          </span>
        ))}
        . Le 1:24 est le bon compromis pour une étagère ou un bureau. Tu choisis la taille au moment de commander, après
        avoir vu ton aperçu.
      </>
    ),
  },
  {
    id: "offrir",
    topic: "Commande",
    q: "Je peux l'offrir ?",
    a: (
      <>
        Oui. Tout est expliqué sur la page <Link href="/offrir">Offrir</Link>, même si tu veux garder la surprise.
      </>
    ),
  },
  {
    id: "delai",
    topic: "Fabrication",
    q: "Combien de temps pour la recevoir ?",
    a: (
      <>
        Chaque miniature est fabriquée à la commande : environ {LEAD_TIME} de fabrication, puis le transport. La
        livraison standard est offerte en France ; l'express et l'envoi hors de France sont payants, leur prix s'affiche
        au paiement.
      </>
    ),
  },
  {
    id: "fidele",
    topic: "Fabrication",
    q: "Est-ce que la miniature ressemblera vraiment à l'aperçu 3D ?",
    a: <>Oui, c'est le même modèle. De légers écarts de teinte ou de détails sont possibles à petite échelle, surtout en 1:43.</>,
  },
  {
    id: "abimee",
    topic: "Fabrication",
    q: "Et si elle arrive abîmée ?",
    a: <>Écris-nous avec une photo : on la refait ou on te rembourse, sans frais. Les garanties légales s'appliquent aussi.</>,
  },
  {
    id: "retour",
    topic: "Fabrication",
    q: "Je peux la renvoyer si je change d'avis ?",
    a: (
      <>
        Non : c'est une pièce unique fabriquée sur mesure, le droit de rétractation ne s'applique pas. Prends le temps de
        bien valider l'aperçu, il est là pour ça.
      </>
    ),
  },
  {
    id: "paiement",
    topic: "Livraison et paiement",
    q: "Comment je paie ?",
    a: (
      <>
        Sur la page de paiement sécurisée de Shopify : carte bancaire, PayPal, Klarna ou Shop Pay, et Apple Pay sur
        iPhone, iPad et Mac.
      </>
    ),
  },
  {
    id: "livraison",
    topic: "Livraison et paiement",
    q: "Combien coûte la livraison ?",
    a: (
      <>
        La livraison standard est offerte en France. L'express et l'envoi hors de France sont payants : leur prix exact
        s'affiche sur la page de paiement, avant de payer.
      </>
    ),
  },
  {
    id: "donnees",
    topic: "Livraison et paiement",
    q: "Que deviennent mes photos ?",
    a: (
      <>
        Elles sont stockées dans un espace privé et servent uniquement à modéliser ta voiture. Tu peux demander leur
        suppression à tout moment. Détails dans la <Link href="/confidentialite">politique de confidentialité</Link>.
      </>
    ),
  },
];

/** Une liste de questions dépliables. `ids` choisit lesquelles montrer (toutes par défaut). */
export function FaqList({ ids }: { ids?: string[] }) {
  const list = ids ? ids.map((id) => QUESTIONS.find((q) => q.id === id)!) : QUESTIONS;
  return (
    <div className="faq-list">
      {list.map(({ id, q, a }) => (
        <details key={id} id={id}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}

export function FaqContact() {
  return (
    <p className="faq-contact">
      Une autre question ? Écris-moi à <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a>, je réponds moi-même.
    </p>
  );
}
