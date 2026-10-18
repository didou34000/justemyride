import LegalPage from "@/components/LegalPage";
import { SELLER } from "@/lib/legal";

export const metadata = { title: "Politique de confidentialité — JustMyRide" };

export default function Confidentialite() {
  return (
    <LegalPage title="Politique de confidentialité">
      <h2>Responsable du traitement</h2>
      <p>
        {SELLER.name}, {SELLER.form}, {SELLER.address}. Contact :{" "}
        <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a>.
      </p>

      <h2>Données collectées et finalités</h2>
      <ul>
        <li>
          <strong>Photos de votre voiture</strong> (8 angles et détails éventuels), voiture indiquée et adresse e-mail,
          lorsque vous envoyez vos photos : pour modéliser votre voiture en 3D et vous recontacter. Base légale : votre
          consentement, donné avant l'envoi. Les photos peuvent montrer votre plaque d'immatriculation ou votre
          environnement : évitez d'y faire figurer des personnes.
        </li>
        <li>
          <strong>Données de commande</strong> (nom, adresses, e-mail, téléphone éventuel, configuration choisie) :
          pour traiter, fabriquer et livrer votre commande. Base légale : exécution du contrat et obligations comptables.
        </li>
        <li>
          <strong>Paiement</strong> : traité directement par Shopify ; {SELLER.brand} n'a jamais accès à vos numéros de
          carte.
        </li>
      </ul>
      <p>Le site n'utilise ni cookie publicitaire ni outil de mesure d'audience.</p>

      <h2>Destinataires et sous-traitants</h2>
      <ul>
        <li>Vercel (hébergement du site, stockage privé des photos à Paris).</li>
        <li>Shopify (commandes, paiement, e-mails de commande).</li>
        <li>Resend (envoi des e-mails d'alerte internes, contenant votre e-mail et votre voiture).</li>
        <li>
          Anthropic (analyse automatique des photos par l'IA Claude, pour comparer votre voiture au modèle de base et
          repérer ses modifications ; les données transmises par API ne servent pas à entraîner ses modèles).
        </li>
        <li>
          Meshy (génération du modèle 3D : jusqu'à 4 de vos photos peuvent lui être transmises, uniquement si une
          modélisation est lancée pour votre voiture).
        </li>
      </ul>
      <p>
        Certains de ces prestataires sont situés hors de l'Union européenne (notamment aux États-Unis) ; les transferts
        sont encadrés par les garanties prévues par le RGPD (clauses contractuelles types ou cadre de protection des
        données UE–États-Unis). Vos données ne sont jamais vendues.
      </p>

      <h2>Durée de conservation</h2>
      <ul>
        <li>Photos et demande : 12 mois après la livraison de la miniature, ou 12 mois après l'envoi si aucune commande n'est passée.</li>
        <li>Données de commande et factures : 10 ans (obligation comptable).</li>
      </ul>

      <h2>Vos droits</h2>
      <p>
        Vous pouvez accéder à vos données, les rectifier, les faire supprimer, demander leur portabilité, vous opposer à
        leur traitement ou en limiter l'usage, et retirer votre consentement à tout moment (par exemple pour faire
        supprimer vos photos). Écrivez à <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a> ; réponse sous un mois.
        Vous pouvez aussi adresser une réclamation à la CNIL (<a href="https://www.cnil.fr">cnil.fr</a>).
      </p>
    </LegalPage>
  );
}
