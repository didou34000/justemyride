import { readJson, writeJson } from "@/lib/blobJson";
import { saveBase } from "@/lib/base";

/**
 * Fichiers déposés par le propriétaire dans une demande :
 * base = un autre modèle de base (.glb) si le téléchargement Sketchfab ne marche pas ;
 * couleurs = la voiture repeinte refaite par Claude dans Blender (remplace celle du site pour le 2e rapport) ;
 * final = la miniature terminée (.glb), à valider avant d'envoyer au client.
 */
export const FICHIERS = ["base", "couleurs", "final"] as const;
export type FichierKind = (typeof FICHIERS)[number];
export type Fichiers = Partial<Record<Exclude<FichierKind, "base">, string>>;

const path = (id: string) => `submissions/${id}/fichiers.json`;
export const readFichiers = async (id: string) => (await readJson<Fichiers>(path(id))) ?? {};
export const isFichierKind = (k: unknown): k is FichierKind => FICHIERS.includes(k as FichierKind);

export async function setFichier(id: string, kind: FichierKind, pathname: string) {
  if (!pathname.startsWith(`submissions/${id}/${kind}`)) throw new Error("Chemin refusé");
  // Le modèle de base n'a qu'une source de vérité : sa fiche base.json.
  if (kind === "base") {
    await saveBase(id, { status: "done", startedAt: new Date().toISOString(), source: "depose", label: "Modèle déposé", glb: pathname });
    return readFichiers(id);
  }
  const f = await readFichiers(id);
  f[kind] = pathname;
  await writeJson(path(id), f);
  return f;
}
