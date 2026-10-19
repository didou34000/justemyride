import LegalPage from "@/components/LegalPage";
import { pageMeta } from "@/lib/site";
import { HOST, SELLER } from "@/lib/legal";

export const metadata = pageMeta({
  title: "Mentions légales",
  description:
    "Éditeur, hébergeur et propriété intellectuelle du site JustMyRide, miniatures de voitures personnalisées.",
  path: "/mentions-legales",
});

export default function MentionsLegales() {
  return (
    <LegalPage title="Mentions légales">
      <h2>Éditeur du site</h2>
      <p>
        Le site {SELLER.brand} ({SELLER.site}) est édité par {SELLER.name}, {SELLER.form}.
        <br />
        Adresse : {SELLER.address}
        <br />
        SIREN : {SELLER.siren} · SIRET : {SELLER.siret}
        <br />
        Immatriculé au Registre national des entreprises (RNE).
        <br />
        N° de TVA intracommunautaire : {SELLER.vat}
        <br />
        E-mail : <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a>
        {SELLER.phone && (
          <>
            <br />
            Téléphone : {SELLER.phone}
          </>
        )}
      </p>
      <p>Directeur de la publication : {SELLER.name}.</p>

      <h2>Hébergement</h2>
      <p>
        Le site est hébergé par {HOST.name}, {HOST.address} (<a href={HOST.url}>{HOST.url.replace("https://", "")}</a>).
        Les photos envoyées par les clients sont stockées par Vercel dans un espace privé situé à Paris.
      </p>
      <p>
        Les paiements et les commandes sont gérés par Shopify International Limited, Victoria Buildings, 1-2 Haddington
        Road, Dublin 4, Irlande.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Les textes, visuels, le logo et le code du site appartiennent à {SELLER.name}, sauf mention contraire. Les modèles
        3D de base issus de Sketchfab restent la propriété de leurs auteurs, crédités sur chaque page, et sont utilisés
        selon leur licence. Les marques automobiles citées appartiennent à leurs titulaires ; {SELLER.brand} n'est ni
        affilié ni approuvé par ces constructeurs.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Voir la <a href="/confidentialite">politique de confidentialité</a>.
      </p>
    </LegalPage>
  );
}
