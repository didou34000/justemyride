/** Les étapes d'une commande (partagé entre le serveur et les pages admin). */

/** Étapes cochées à la main, avec la date. */
export const MANUAL = ["rendu", "accord", "impression", "expedie"] as const;
export type ManualStep = (typeof MANUAL)[number];
export type Suivi = Partial<Record<ManualStep, string>>;

export type StepState = "done" | "current" | "todo" | "error" | "skip";
/** busy : une machine travaille vraiment dessus (téléchargement, Claude), pas seulement « à faire ». */
export type Step = { key: string; label: string; who: string; state: StepState; date?: string; note?: string; busy?: boolean };

/** Couleur du bloc selon qui agit (client, Claude, toi, Blender, atelier). */
export type Tone = "client" | "claude" | "toi" | "blender" | "meshy" | "atelier";

/** Le parcours d'une commande, dans l'ordre. Sert aussi au schéma explicatif. */
export const STEPS: { key: string; label: string; who: string; tone: Tone; help: string; manual?: ManualStep }[] = [
  { key: "base", label: "Modèle de base", who: "Client + site (auto)", tone: "client", help: "Le client choisit son modèle Sketchfab : c'est la base de tout. Le site le télécharge dans la commande dès l'envoi." },
  { key: "photos", label: "Photos reçues", who: "Client", tone: "client", help: "Les photos de la vraie voiture. Tu reçois un e-mail." },
  { key: "rapport1", label: "1er rapport", who: "Claude (auto)", tone: "claude", help: "Claude compare les photos au modèle de base : hauteur de caisse, jantes, logos oubliés, stickers, prises d'air, teintes…" },
  { key: "couleurs", label: "Couleurs refaites", who: "Claude (auto)", tone: "claude", help: "Claude donne une couleur et une finition à chaque matériau du modèle. Seules les couleurs changent : la forme reste celle du modèle." },
  { key: "rapport2", label: "2e rapport", who: "Claude (auto)", tone: "claude", help: "Claude compare la voiture repeinte aux photos : ce qui se répare dans Blender, et la liste des formes 3D à ajouter." },
  { key: "v2", label: "V2 corrigée", who: "Claude + Blender", tone: "blender", help: "Dans le chat du projet, Claude fait les corrections du 2e rapport dans Blender (zones à repeindre, hauteur…). Tu déposes ici la V2." },
  { key: "rapport3", label: "Ce qui manque", who: "Claude (auto)", tone: "claude", help: "Claude compare la V2 aux photos : ce qui manque encore, essentiel ou secondaire, et 4 pièces au plus à faire par Meshy." },
  { key: "meshy", label: "Pièces Meshy", who: "Toi + Meshy", tone: "meshy", help: "Chaque pièce essentielle est refaite par Meshy d'après la photo recadrée sur elle. Tu vérifies les recadrages et tu lances (payant, 4 max)." },
  { key: "retouches", label: "Assemblage final", who: "Claude + Blender", tone: "blender", help: "Dans le chat du projet, Claude pose les pièces Meshy sur la V2. Tu déposes ici la miniature terminée." },
  { key: "rendu", label: "Rendu envoyé", who: "Toi", tone: "toi", help: "Tu envoies les rendus au client pour validation.", manual: "rendu" },
  { key: "accord", label: "Client OK + paiement", who: "Client", tone: "client", help: "Le client valide son rendu et paie.", manual: "accord" },
  { key: "impression", label: "Impression", who: "Atelier", tone: "atelier", help: "Fichier envoyé à l'impression, peinture, finitions.", manual: "impression" },
  { key: "expedie", label: "Expédiée", who: "Toi", tone: "toi", help: "Colis parti chez le client.", manual: "expedie" },
];
