/** Les étapes d'une commande (partagé entre le serveur et les pages admin). */

/** Étapes cochées à la main, avec la date. */
export const MANUAL = ["valide", "assemblage", "rendu", "accord", "impression", "expedie"] as const;
export type ManualStep = (typeof MANUAL)[number];
export type Suivi = Partial<Record<ManualStep, string>>;

export type StepState = "done" | "current" | "todo" | "error" | "skip";
/** busy : une machine travaille vraiment dessus (analyse, Meshy), pas seulement « à faire ». */
export type Step = { key: string; label: string; who: string; state: StepState; date?: string; note?: string; busy?: boolean };

/** Le parcours d'une commande, dans l'ordre. Sert aussi à la frise explicative. */
/** Couleur du bloc selon qui agit (client, Claude, toi, Meshy, Blender, atelier). */
export type Tone = "client" | "claude" | "toi" | "meshy" | "blender" | "atelier";

export const STEPS: { key: string; label: string; who: string; tone: Tone; help: string; manual?: ManualStep }[] = [
  { key: "photos", label: "Photos reçues", who: "Client", tone: "client", help: "Le client choisit sa voiture, envoie ses 8 photos et ses détails. Tu reçois un e-mail." },
  { key: "analyse", label: "Le point", who: "Claude (auto)", tone: "claude", help: "Claude compare toutes les photos à la voiture de base et liste les différences. 2e e-mail." },
  { key: "valide", label: "Point validé", who: "Toi", tone: "toi", help: "Tu relis le point, tu corriges si besoin, tu valides.", manual: "valide" },
  { key: "pieces", label: "Pièces 3D", who: "Meshy", tone: "meshy", help: "Les pièces différentes sont générées (bibliothèque d'abord, Meshy sinon). Tu lances, c'est plafonné." },
  { key: "details", label: "Détails manquants", who: "Claude (auto)", tone: "claude", help: "Claude compare le rendu Meshy aux photos et liste les petits détails qui manquent (badges, logos, petites pièces), avec où les trouver." },
  { key: "logos", label: "Logos", who: "Claude (auto)", tone: "claude", help: "Les badges 3D de la bibliothèque (faits par Claude, sans copier les logos de marque) sont ajoutés tout seuls si la voiture est connue. Sinon tu déposes une image." },
  { key: "assemblage", label: "Assemblage & résultat", who: "Claude + Blender", tone: "blender", help: "Claude assemble dans Blender : voiture, logos, couleurs, vitres teintées. Tu déposes ici la miniature terminée pour la voir en 3D." },
  { key: "rendu", label: "Rendu envoyé", who: "Toi", tone: "toi", help: "Tu envoies les rendus au client pour validation.", manual: "rendu" },
  { key: "accord", label: "Client OK + paiement", who: "Client", tone: "client", help: "Le client valide son rendu et paie.", manual: "accord" },
  { key: "impression", label: "Impression", who: "Atelier", tone: "atelier", help: "Fichier envoyé à l'impression, peinture, finitions.", manual: "impression" },
  { key: "expedie", label: "Expédiée", who: "Toi", tone: "toi", help: "Colis parti chez le client.", manual: "expedie" },
];

/** Les photos envoyées à Meshy pour le multi-vues (4 au maximum), dans cet ordre. */
export const MESHY_VIEWS = ["avant", "gauche", "arriere", "droite"];

/**
 * Photos à donner à Meshy : les 4 faces si elles existent (anciennes demandes à 8 angles), sinon les 3/4 avant
 * et arrière (les 2 photos obligatoires depuis octobre 2026) puis les autres photos. Jamais les gros plans.
 */
export function meshyPhotos(files: { slot: string; pathname: string }[]): string[] {
  const order = [...MESHY_VIEWS, "avant-gauche", "arriere-droite", "arriere-gauche", "avant-droite"];
  const ranked = [
    ...order.map((v) => files.find((f) => f.slot === v)),
    ...files.filter((f) => /^photo-\d+$/.test(f.slot)),
  ].filter(Boolean) as { pathname: string }[];
  return [...new Set(ranked.map((f) => f.pathname))].slice(0, 4);
}
