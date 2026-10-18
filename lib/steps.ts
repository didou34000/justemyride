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
  { key: "assemblage", label: "Assemblage & couleurs", who: "Claude + Blender", tone: "blender", help: "Pose des pièces sur la base, couleurs, décalques. Rendus de la miniature.", manual: "assemblage" },
  { key: "rendu", label: "Rendu envoyé", who: "Toi", tone: "toi", help: "Tu envoies les rendus au client pour validation.", manual: "rendu" },
  { key: "accord", label: "Client OK + paiement", who: "Client", tone: "client", help: "Le client valide son rendu et paie.", manual: "accord" },
  { key: "impression", label: "Impression", who: "Atelier", tone: "atelier", help: "Fichier envoyé à l'impression, peinture, finitions.", manual: "impression" },
  { key: "expedie", label: "Expédiée", who: "Toi", tone: "toi", help: "Colis parti chez le client.", manual: "expedie" },
];

