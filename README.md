# JustMyRide

Site de miniatures de voitures personnalisées. V1 : une page simple où le client renseigne sa voiture, ajoute ses photos, choisit ses options et commande.

## Lancer en local

```bash
npm install
npm run dev
# http://localhost:3000
```

## Ce que fait le site

- **Accueil (`/`)** : dépôt de la voiture. Deux modes : **4 photos guidées** (avant, gauche, arrière, droite, + photos de détail facultatives), recommandé car c'est l'entrée idéale des IA multi-vues (Tripo, Meshy), ou **une vidéo** (tour complet, plus simple pour le client, on en extrait les images). Plus email et nom de la voiture.
- Les fichiers partent directement du navigateur vers **Vercel Blob** (jusqu'à 500 Mo par fichier), dans `submissions/<date>-<id>/`, avec un `demande.json` (email, voiture, liste des fichiers).
- Sans stockage branché, l'envoi est simulé (« mode démo »).

## Brancher le stockage des photos (Vercel Blob)

1. Dans Vercel : projet → **Storage** → **Create** → **Blob**, en accès **Private** (les photos montrent des plaques), puis le connecter au projet.
2. Vercel ajoute tout seul la variable `BLOB_READ_WRITE_TOKEN`. Redéployer.
3. Les demandes reçues se consultent dans Storage → le store Blob → dossier `submissions/`.
4. Si tu crées un store **Public** à la place, ajoute `NEXT_PUBLIC_BLOB_ACCESS=public`.

## Configurateur (`/configurer`)

- Page d'accueil + configurateur : voiture (marque, modèle, année), photos ou vidéo, peinture (8 teintes + couleur libre, finition brillant / métallisé / mat), jantes (style + couleur), aileron, plaque, taille (1:43, 1:24, 1:18), finitions (socle, vitrine).
- Aperçu 2D en direct (SVG) qui suit les choix. Il sera remplacé par le viewer 3D.
- Prix calculé en direct (`lib/options.ts`). **Les prix sont provisoires.**
- Bouton « Commander » : crée un panier Shopify via la Storefront API si les variables d'environnement sont renseignées, sinon affiche un message « mode démo ».

## Pas encore fait

- Les photos restent dans le navigateur : rien n'est envoyé ni stocké côté serveur.
- Pas de viewer 3D ni de génération IA.
- Shopify n'est pas branché (aucune clé).

## Brancher Shopify

1. Dans Shopify : créer un produit « Miniature » avec 3 variantes (1:43, 1:24, 1:18), plus un produit par option payante (aileron GT, socle, vitrine).
2. Créer une app avec accès Storefront API et récupérer le jeton.
3. Copier `.env.example` en `.env.local` et remplir le domaine, le jeton et les IDs de variantes (`gid://shopify/ProductVariant/...`).
4. La configuration du client (couleur, jantes, plaque…) est transmise comme attributs de la ligne de panier et apparaît dans la commande Shopify.

## Déployer sur Vercel

Importer le dépôt dans Vercel (framework détecté automatiquement), puis ajouter les mêmes variables d'environnement.
