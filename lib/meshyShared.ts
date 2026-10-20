/** Plafonds par commande, échecs compris : générations 3D et dessins (tous deux payants chez Meshy). */
export const MAX_3D = 4;
export const MAX_IMAGES = 12;
/** Tarif Meshy (docs.meshy.ai/api/pricing, oct. 2026) : dessin nano-banana-pro 9 crédits, 3D sans texture 20 crédits. */
export const CREDITS = { image: 9, "3d": 20 } as const;

/**
 * Le prompt envoyé au modèle d'image de Meshy pour dessiner une pièce seule de 3/4.
 * Partagé avec la page admin, qui l'affiche et permet de le corriger avant d'envoyer.
 */
export const imagePrompt = (piece: string, consigne: string) =>
  `Recreate the complete ${piece} visible in the reference photo, alone, as one isolated object: ` +
  `three-quarter view, centered, the whole element visible, plain white background, soft studio light, product shot. ` +
  `If it is a wheel or a rim: show the COMPLETE WHEEL, the rim with its tyre mounted on it (tyre sidewall and tread visible), never the rim alone, even if the details below say otherwise. ` +
  `Reproduce it exactly as in the photo: same design, same shapes, same number of spokes or slats, same proportions, same colours and details. ` +
  `No car body, no other parts, no text, no shadow.\n` +
  `Details (French): ${consigne}`;

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
  /** Le dessin produit (job image) ou utilisé (job 3D). */
  image?: string;
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
export const jobFailed = (j: PieceJob) => ["FAILED", "CANCELED", "error"].includes(j.status);
/** Un job est fini quand il a son résultat (dessin ou GLB) ou qu'il a échoué. */
export const jobDone = (j: PieceJob) => jobFailed(j) || (jobKind(j) === "image" ? Boolean(j.image) : Boolean(j.glb));
export const piecesRunning = (p: Pieces | null) => Boolean(p?.jobs.some((j) => !jobDone(j)));
/** La 3D retenue de chaque pièce (sinon la dernière réussie). */
export const retained3d = (p: Pieces) => {
  const out = new Map<number, PieceJob>();
  p.jobs.forEach((j) => j.glb && out.set(j.index, j));
  for (const [i, n] of Object.entries(p.choix3d ?? {})) if (p.jobs[n]?.glb) out.set(Number(i), p.jobs[n]);
  return [...out.values()];
};
