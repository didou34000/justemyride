import LegalPage from "@/components/LegalPage";
import { pageMeta } from "@/lib/site";
import { LEAD_TIME, SELLER } from "@/lib/legal";
import { accessories, sizes } from "@/lib/options";

export const metadata = pageMeta({
  title: "Conditions générales de vente",
  description:
    "Conditions de vente des miniatures JustMyRide : prix, commande et paiement, fabrication et livraison, rétractation et garanties.",
  path: "/cgv",
});

export default function CGV() {
  return (
    <LegalPage title="Conditions générales de vente">
      <h2>1. Vendeur</h2>
      <p>
        Les présentes conditions s'appliquent aux ventes conclues sur le site {SELLER.brand} entre {SELLER.name},{" "}
        {SELLER.form}, SIRET {SELLER.siret}, {SELLER.address} (« le vendeur »), et toute personne physique agissant
        en tant que consommateur (« le client »). Contact : <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a>.
      </p>

      <h2>2. Produits</h2>
      <p>
        {SELLER.brand} fabrique des miniatures de voitures personnalisées, en pièce unique, à partir d'un modèle 3D de
        base (catalogue du site, modèle 3D public ou modèle réalisé d'après les photos envoyées par le client) et des
        choix faits dans le configurateur : teinte, finition, jantes, échappement, étriers, taille et finitions.
      </p>
      <p>
        L'aperçu 3D est une représentation : de légers écarts de teinte, de proportions ou de détails sont possibles par
        rapport à la miniature fabriquée, notamment à petite échelle. Les miniatures sont des objets de décoration et de
        collection, pas des jouets : elles ne conviennent pas aux enfants de moins de 14 ans.
      </p>

      <h2>3. Prix</h2>
      <p>Les prix sont indiqués en euros, toutes taxes comprises, hors frais de livraison :</p>
      <ul>
        {sizes.map((s) => (
          <li key={s.id}>
            Miniature {s.label} ({s.length}) : {s.price} €
          </li>
        ))}
        {accessories.map((a) => (
          <li key={a.id}>
            {a.label} : +{a.price} €
          </li>
        ))}
      </ul>
      {SELLER.vatFranchise && <p>TVA non applicable, article 293 B du Code général des impôts.</p>}
      <p>Le prix applicable est celui affiché au moment de la commande. Les frais de livraison sont indiqués avant le paiement.</p>

      <h2>4. Commande et paiement</h2>
      <p>
        Le client configure sa miniature puis valide sa commande sur la page de paiement sécurisée de Shopify. La commande
        est ferme après paiement ; un e-mail de confirmation est envoyé. Le paiement se fait par carte bancaire, PayPal ou
        Klarna et est débité à la commande.
      </p>
      <p>
        Lorsque la voiture n'existe pas encore dans le catalogue, le client envoie d'abord ses photos. Cet envoi est
        gratuit et sans engagement : le vendeur réalise le modèle 3D et contacte le client par e-mail pour qu'il le
        personnalise et commande.
      </p>

      <h2>5. Fabrication et livraison</h2>
      <p>
        Chaque miniature est fabriquée à la commande. Le délai de fabrication est d'environ {LEAD_TIME} après la commande
        (ou après validation du modèle 3D par le client), auquel s'ajoute le délai de transport du mode de livraison
        choisi. En cas de retard, le client est prévenu par e-mail ; si la livraison dépasse de plus de 30 jours la date
        annoncée, il peut annuler sa commande et être remboursé.
      </p>
      <p>
        Les zones, modes et tarifs de livraison sont affichés sur la page de paiement. La miniature voyage aux risques du
        vendeur jusqu'à sa remise au client.
      </p>

      <h2>6. Droit de rétractation</h2>
      <p>
        Conformément à l'article L221-28, 3° du Code de la consommation, le droit de rétractation ne s'applique pas aux
        biens confectionnés selon les spécifications du consommateur ou nettement personnalisés. Chaque miniature étant
        fabriquée sur mesure à partir de la configuration du client, <strong>elle ne peut être ni reprise ni échangée
        pour simple changement d'avis</strong>. Le client en est informé avant de commander.
      </p>

      <h2>7. Miniature abîmée ou non conforme</h2>
      <p>
        Si la miniature arrive cassée, abîmée ou ne correspond pas à la configuration commandée, le client le signale à{" "}
        <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a>, de préférence dans les 7 jours suivant la réception, avec
        des photos. Le vendeur refait la miniature ou rembourse le client, au choix du client, sans frais.
      </p>
      <p>
        Le client bénéficie en outre de la garantie légale de conformité (articles L217-3 et suivants du Code de la
        consommation, 2 ans à compter de la livraison) et de la garantie des vices cachés (articles 1641 et suivants du
        Code civil). Ces garanties s'appliquent indépendamment de la démarche ci-dessus.
      </p>

      <h2>8. Photos et contenus du client</h2>
      <p>
        Le client garantit être autorisé à utiliser les photos qu'il envoie et ne pas porter atteinte aux droits de
        tiers. Il autorise le vendeur à les utiliser uniquement pour modéliser et fabriquer sa miniature. Le traitement de
        ces données est détaillé dans la <a href="/confidentialite">politique de confidentialité</a>.
      </p>

      <h2>9. Réclamations et médiation</h2>
      <p>
        Pour toute réclamation, le client contacte d'abord le vendeur à{" "}
        <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a>.{" "}
        {SELLER.mediator ? (
          <>
            À défaut d'accord, il peut recourir gratuitement au médiateur de la consommation :{" "}
            <a href={SELLER.mediator.url}>{SELLER.mediator.name}</a>.
          </>
        ) : (
          <>À défaut d'accord, il peut recourir gratuitement à un médiateur de la consommation (en cours de désignation).</>
        )}{" "}
        Il peut aussi utiliser la plateforme européenne de règlement en ligne des litiges :{" "}
        <a href="https://ec.europa.eu/consumers/odr">ec.europa.eu/consumers/odr</a>.
      </p>

      <h2>10. Droit applicable</h2>
      <p>
        Les présentes conditions sont soumises au droit français. En cas de litige, les tribunaux compétents sont ceux
        désignés par la loi ; le consommateur peut saisir la juridiction de son domicile.
      </p>
    </LegalPage>
  );
}
