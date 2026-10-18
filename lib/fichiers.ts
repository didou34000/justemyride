import { readJson, writeJson } from "@/lib/blobJson";

/**
 * Fichiers déposés par le propriétaire dans une demande :
 * logos = l'image des badges préparée par Claude (envoyée à Meshy),
 * final = la miniature assemblée dans Blender (.glb), à valider avant d'envoyer au client.
 */
export const FICHIERS = ["logos", "final"] as const;
export type FichierKind = (typeof FICHIERS)[number];
export type Fichiers = Partial<Record<FichierKind, string>>;

const path = (id: string) => `submissions/${id}/fichiers.json`;
export const readFichiers = async (id: string) => (await readJson<Fichiers>(path(id))) ?? {};
export const isFichierKind = (k: unknown): k is FichierKind => FICHIERS.includes(k as FichierKind);

export async function setFichier(id: string, kind: FichierKind, pathname: string) {
  if (!pathname.startsWith(`submissions/${id}/${kind}`)) throw new Error("Chemin refusé");
  const f = await readFichiers(id);
  f[kind] = pathname;
  await writeJson(path(id), f);
  return f;
}
