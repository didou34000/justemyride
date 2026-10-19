# JustMyRide

Miniatures de voitures personnalisées, en pièce unique. Le client choisit sa voiture (ou envoie 8 photos), la personnalise en 3D, commande et paie sur Shopify ; on la fabrique et on la livre.

En ligne : https://justemyride.vercel.app (Next.js 15, hébergé sur Vercel, déployé à chaque push sur `main`).

## Lancer en local

```bash
npm install
npm run dev
# http://localhost:3000
```

## SEO

- Adresse du site : une seule source, `lib/site.ts` (variable `NEXT_PUBLIC_SITE_URL`, sinon `https://justemyride.vercel.app`). Elle sert aux balises canoniques, au sitemap, à robots.txt et aux données structurées.
- Métadonnées de chaque page publique : `pageMeta()` dans `lib/site.ts`. Pages indexables (= sitemap) : `INDEXABLE_PATHS`.
- Contrôle automatique après un build : `npm run build && npm run seo:check` (titres, descriptions, canoniques, h1, JSON-LD, sitemap, robots, liens internes, pages privées en noindex).
- Rapport d'audit : `/mnt/project-files/justmyride/seo/` (dossier du projet).

## Pages

- **Accueil (`/`)** : la photo d'une vraie voiture se fond dans sa miniature 3D au défilement, puis garanties, étapes, tailles, finitions, envoi des photos et FAQ.
- **Envoi des photos** (sur l'accueil) : choix de la voiture de base, puis 8 angles guidés (photos d'exemple dans `public/guide/*.jpg`), détails facultatifs, e-mail et consentement. Les fichiers partent directement du navigateur vers Vercel Blob, dans `submissions/<date>-<id>/`, avec un `demande.json`.
- **Garage (`/configurer`)** : voitures du catalogue (`lib/cars.ts`) et recherche de modèles Sketchfab.
- **Configurateur (`/configurer/[slug]`, `/configurer/sketchfab/[uid]`)** : teinte, finition, jantes, échappement, étriers, taille, socle et vitrine, avec la miniature 3D sur son socle. « Commander » crée un panier Shopify.
- **Pages légales** : `/cgv`, `/confidentialite`, `/mentions-legales` (infos vendeur dans `lib/legal.ts`).
- **Admin (`/admin`, protégé par mot de passe)** : suivi des demandes, analyse des photos par Claude, génération 3D Meshy.

## Services branchés

| Service | Rôle | Variables |
|---|---|---|
| Vercel Blob (privé, Paris) | photos des clients | `BLOB_STORE_ID` (connexion OIDC, ajoutée par Vercel) ou `BLOB_READ_WRITE_TOKEN` |
| Shopify (headless) | produits, paiement, commandes | `SHOPIFY_STOREFRONT_TOKEN` (boutique et IDs de variantes dans `lib/shopify.ts`) |
| Resend | e-mail d'alerte à chaque envoi de photos | `RESEND_API_KEY`, `NOTIFY_EMAIL`, `RESEND_FROM` (facultatif) |
| Sketchfab | recherche et téléchargement de modèles 3D | `SKETCHFAB_API_TOKEN` |
| Anthropic (Claude) | analyse automatique des photos | `ANTHROPIC_API_KEY`, plafonds `ANALYSE_*_LIMIT` |
| Meshy | génération 3D depuis les photos, lancée depuis l'admin | `MESHY_API_KEY`, plafonds `MESHY_*_LIMIT` |
| Admin | accès au tableau de bord | `ADMIN_PASSWORD`, `ADMIN_TOKEN` |

Voir `.env.example` pour la liste complète. Sans une variable, la fonction concernée se désactive (mode démo pour le stockage et le paiement).

## À faire

- Désigner un médiateur de la consommation et le renseigner dans `lib/legal.ts` (`mediator`).
- Domaine `justmyride.shop` : une fois acheté, mettre `NEXT_PUBLIC_SITE_URL` dans Vercel, mettre à jour la redirection du thème Shopify et l'expéditeur Resend.
