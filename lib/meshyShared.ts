/** Plafonds par commande, échecs compris : générations 3D et dessins (tous deux payants chez Meshy). */
export const MAX_3D = 4;
/** Les sortes d'éléments faits en 3D par Meshy, chacune avec son propre plafond de générations 3D par commande. */
export const TYPES_3D = {
  piece: { label: "Pièce", max: MAX_3D },
  sticker: { label: "Sticker", max: 2 },
} as const;
export type Type3D = keyof typeof TYPES_3D;
export const isType3D = (t: unknown): t is Type3D => typeof t === "string" && t in TYPES_3D;
/**
 * Générations 3D déjà faites (échecs compris) pour une sorte d'élément ; les anciens jobs sans sorte sont des pièces.
 * Une pièce prise dans la bibliothèque ne compte pas : elle n'a rien coûté.
 */
export const count3dOf = (p: { jobs: PieceJob[] }, t: Type3D) =>
  p.jobs.filter((j) => jobKind(j) === "3d" && !j.bibliotheque && (j.type ?? "piece") === t).length;
/** Dessins comptés image par image (2 images par clic). */
export const MAX_IMAGES = 12;
/**
 * Tarif Meshy (docs.meshy.ai/api/pricing, oct. 2026) : une vue dessinée nano-banana 3 crédits (nano-banana-pro 9) ;
 * 3D sans texture 20 crédits d'après 1 image (le tarif multi-images n'est pas publié : on affiche le vrai montant une fois facturé).
 */
export const CREDITS = { image: 3, "3d": 20 } as const;

/** Modèles d'image Meshy proposés pour dessiner les vues, avec leur prix par vue (docs.meshy.ai/api/pricing). */
export const IMAGE_MODELS = {
  "nano-banana": { label: "Standard", credits: 3 },
  "nano-banana-pro": { label: "Pro, plus fidèle", credits: 9 },
} as const;
export type ImageModel = keyof typeof IMAGE_MODELS;
export const DEFAULT_IMAGE_MODEL: ImageModel = "nano-banana";
export const isImageModel = (m: unknown): m is ImageModel => typeof m === "string" && m in IMAGE_MODELS;
/** Prix d'une vue pour un job (les anciens jobs sans modèle étaient en Pro). */
export const viewCredits = (j: { model?: string }) => (isImageModel(j.model) ? IMAGE_MODELS[j.model].credits : IMAGE_MODELS["nano-banana-pro"].credits);

/**
 * Deux images dessinées par pièce, chacune avec son prompt : de face (l'élément complet), puis de côté d'après
 * l'image de face (même objet), pour montrer la largeur (pour une roue : la largeur du pneu). La 3D part des deux.
 */
export const VUES = [
  {
    key: "face",
    label: "De face",
    prompt:
      "IMAGE 1 of 2, FRONT VIEW: the complete element seen straight on, centered, filling most of the frame. " +
      "For a wheel: the whole rim face with the tyre all around it.",
  },
  {
    key: "cote",
    label: "De côté",
    prompt:
      "IMAGE 2 of 2, SIDE VIEW: the same object rotated 90°, seen exactly in profile, showing its full width and thickness. " +
      "For a wheel: the tyre tread seen edge-on, so its real width is visible, with the edge of the rim.",
  },
] as const;
const SAME =
  "The second reference image shows this exact object already drawn: keep exactly the same object (same design, proportions, colours), only the camera angle changes.";
/** Le prompt complet d'une vue : le prompt de base (modifiable) + l'angle demandé. */
export const viewPrompt = (base: string, k: number) => `${VUES[k].prompt}${k ? ` ${SAME}` : ""}\n${base}`;

/**
 * Le prompt de base envoyé au modèle d'image de Meshy pour dessiner une pièce seule (l'angle de chaque image s'ajoute devant, voir VUES).
 * Partagé avec la page admin, qui l'affiche et permet de le corriger avant d'envoyer.
 */
export const imagePrompt = (piece: string, consigne: string, type: Type3D = "piece") =>
  type === "sticker" ? stickerPrompt(piece, consigne) : partPrompt(piece, consigne);

const stickerPrompt = (piece: string, consigne: string) =>
  `Recreate the ${piece} (a sticker / decal) visible in the reference photo, alone, as a thin flat plate about 1 mm thick: ` +
  `centered, the whole decal visible and flattened (as if peeled off the car and laid flat), plain white background, soft studio light. ` +
  `Reproduce its exact outline, graphics, colours and proportions. No car body, no shadow.\n` +
  `Details (French): ${consigne}`;

const partPrompt = (piece: string, consigne: string) =>
  `Recreate the complete ${piece} visible in the reference photo, alone, as one isolated object: ` +
  `centered, the whole element visible, plain white background, soft studio light, product shot. ` +
  `If it is a wheel or a rim: show the COMPLETE WHEEL, the rim with its tyre mounted on it (tyre sidewall and tread visible), never the rim alone, even if the details below say otherwise. ` +
  `Reproduce it exactly as in the photo: same design, same shapes, same number of spokes or slats, same proportions, same colours and details. ` +
  `No car body, no other parts, no text, no shadow.\n` +
  `Details (French): ${consigne}`;

export type Vue = {
  angle: string;
  status: PieceJob["status"];
  taskId?: string;
  progress?: number;
  image?: string;
  error?: string;
  credits?: number;
};

export type PieceJob = {
  /** Rang de la pièce dans le 3e rapport. */
  index: number;
  piece: string;
  /** Sorte d'élément (pièce, sticker) : chacune a son plafond. Absent = pièce. */
  type?: Type3D;
  /** image = dessin de la pièce seule ; 3d = la pièce en 3D. Absent = ancien job (3D). */
  kind?: "image" | "3d";
  /** Ancien format (dessin puis 3D enchaînés) : lu seulement. */
  stage?: "image" | "3d";
  crop: string;
  /** Le prompt de base (dessin). */
  prompt?: string;
  /** Le prompt complet de chaque image, dans l'ordre de VUES (corrigé dans l'admin). */
  prompts?: string[];
  /** Le modèle d'image utilisé (dessin). */
  model?: string;
  /** Le dessin produit (job image : la 1re vue) ou utilisé (job 3D). */
  image?: string;
  /** Job image : les vues dessinées (3/4, côté, arrière). Job 3D : les images envoyées. */
  vues?: Vue[];
  images?: string[];
  /** Job 3D : l'API utilisée (absent = image-to-3d). */
  endpoint?: "image-to-3d" | "multi-image-to-3d";
  imageTaskId?: string;
  status: "starting" | "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED" | "error";
  taskId?: string;
  progress?: number;
  glb?: string;
  thumb?: string;
  error?: string;
  /** Crédits Meshy réellement facturés (0 si échec : remboursé). */
  credits?: number;
  /** Pièce reprise de la bibliothèque (son id) : rien n'est parti chez Meshy. */
  bibliotheque?: string;
  /** Nom de la pièce de la bibliothèque reprise. */
  bibliothequeNom?: string;
  startedAt: string;
};
export type Pieces = {
  jobs: PieceJob[];
  /** Pour chaque pièce (rang du 3e rapport), le n° du job retenu : le dessin qui part en 3D, la 3D qui sert à l'assemblage. */
  choixImage?: Record<number, number>;
  choix3d?: Record<number, number>;
};

export const jobKind = (j: PieceJob) => j.kind ?? (j.stage === "image" ? "image" : "3d");
const failedStatus = (s: string) => ["FAILED", "CANCELED", "error"].includes(s);
export const jobFailed = (j: PieceJob) => failedStatus(j.status);
export const vueDone = (v: Vue) => Boolean(v.image) || failedStatus(v.status);
/** Un job est fini quand il a son résultat (toutes les vues ou le GLB) ou qu'il a échoué. */
export const jobDone = (j: PieceJob) =>
  jobFailed(j) || (jobKind(j) === "image" ? (j.vues ? j.vues.every(vueDone) : Boolean(j.image)) : Boolean(j.glb));
/** Les dessins réussis d'un job image (les vues, ou l'image unique des anciens jobs). */
export const jobImages = (j: PieceJob) => (j.vues ? j.vues.flatMap((v) => (v.image ? [v.image] : [])) : j.image ? [j.image] : []);
/** Nombre de vues dessinées comptées dans le plafond. */
export const imageCount = (j: PieceJob) => (jobKind(j) !== "image" ? 0 : j.vues?.length ?? 1);
export const piecesRunning = (p: Pieces | null) => Boolean(p?.jobs.some((j) => !jobDone(j)));
/** La 3D retenue de chaque pièce (sinon la dernière réussie). */
export const retained3d = (p: Pieces) => {
  const out = new Map<number, PieceJob>();
  p.jobs.forEach((j) => j.glb && out.set(j.index, j));
  for (const [i, n] of Object.entries(p.choix3d ?? {})) if (p.jobs[n]?.glb) out.set(Number(i), p.jobs[n]);
  return [...out.values()];
};
