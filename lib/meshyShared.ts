/** Plafonds par commande, échecs compris : générations 3D et dessins (tous deux payants chez Meshy). */
export const MAX_3D = 4;
/** Dessins comptés vue par vue (une série = 3 vues). */
export const MAX_IMAGES = 18;
/**
 * Tarif Meshy (docs.meshy.ai/api/pricing, oct. 2026) : une vue dessinée nano-banana-pro 9 crédits ;
 * 3D sans texture 20 crédits d'après 1 image (le tarif multi-images n'est pas publié : on affiche le vrai montant une fois facturé).
 */
export const CREDITS = { image: 9, "3d": 20 } as const;

/** Les vues dessinées pour chaque pièce : la 3/4 d'abord, puis le côté et l'arrière d'après elle (même objet). */
export const VUES = [
  {
    key: "34",
    label: "3/4 avant",
    prompt:
      "VIEW 1 of 3, THREE-QUARTER VIEW: the object turned about 40° away from the camera, so its face AND its side depth are both clearly visible. Not a flat front view.",
  },
  {
    key: "cote",
    label: "Côté",
    prompt:
      "VIEW 2 of 3, SIDE VIEW: the same object turned 90°, seen exactly in profile, showing its full thickness (for a wheel: the tyre tread and the width of the rim).",
  },
  {
    key: "arriere",
    label: "Arrière",
    prompt:
      "VIEW 3 of 3, BACK VIEW: the same object turned 180°, showing its back or inner side (for a wheel: the inner face of the rim and the hub mounting face).",
  },
] as const;
const SAME =
  "The second reference image shows this exact object already drawn: keep exactly the same object (same design, proportions, colours), only the camera angle changes.";
/** Le prompt complet d'une vue : le prompt de base (modifiable) + l'angle demandé. */
export const viewPrompt = (base: string, k: number) => `${VUES[k].prompt}${k ? ` ${SAME}` : ""}\n${base}`;

/**
 * Le prompt de base envoyé au modèle d'image de Meshy pour dessiner une pièce seule (l'angle de chaque vue s'ajoute, voir VUES).
 * Partagé avec la page admin, qui l'affiche et permet de le corriger avant d'envoyer.
 */
export const imagePrompt = (piece: string, consigne: string) =>
  `Recreate the complete ${piece} visible in the reference photo, alone, as one isolated object: ` +
  `centered, the whole element visible, plain white background, soft studio light, product shot. ` +
  `If it is a wheel or a rim: show the COMPLETE WHEEL, the rim with its tyre mounted on it (tyre sidewall and tread visible), never the rim alone, even if the details below say otherwise. ` +
  `Reproduce it exactly as in the photo: same design, same shapes, same number of spokes or slats, same proportions, same colours and details. ` +
  `No car body, no other parts, no text, no shadow.\n` +
  `Details (French): ${consigne}`;

export type Vue = {
  angle: (typeof VUES)[number]["key"];
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
  /** image = dessin de la pièce seule ; 3d = la pièce en 3D. Absent = ancien job (3D). */
  kind?: "image" | "3d";
  /** Ancien format (dessin puis 3D enchaînés) : lu seulement. */
  stage?: "image" | "3d";
  crop: string;
  /** Le prompt envoyé (dessin). */
  prompt?: string;
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
