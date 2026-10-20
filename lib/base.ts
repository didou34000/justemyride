import { put } from "@vercel/blob";
import { readJson, writeJson } from "@/lib/blobJson";
import { BLOB_ACCESS } from "@/lib/storage";
import { download, licenceOk, model } from "@/lib/sketchfab";
import { cars } from "@/lib/cars";
import { readDemande, stale } from "@/lib/claude";
import { zipToGlb } from "@/lib/glb";

/**
 * Étape 1 : le modèle de base. C'est le modèle Sketchfab choisi par le client, et on ne s'en écarte plus :
 * tout le reste (rapports, couleurs) part de ce fichier. Il est téléchargé dans la commande dès l'envoi.
 */

export type BaseRecord = {
  status: "running" | "done" | "error";
  startedAt: string;
  /** sketchfab = téléchargé tout seul ; garage = voiture déjà préparée du site ; depose = fichier déposé par l'admin. */
  source: "sketchfab" | "garage" | "depose";
  label: string;
  uid?: string;
  author?: string;
  licence?: string;
  /** Le .glb dans le stockage (submissions/<id>/base.glb), ou un fichier public pour le garage. */
  glb?: string;
  sizeMb?: number;
  error?: string;
};

const path = (id: string) => `submissions/${id}/base.json`;
export const readBase = (id: string) => readJson<BaseRecord>(path(id));

export async function saveBase(id: string, r: BaseRecord) {
  await writeJson(path(id), r);
  return r;
}

/** Télécharge le modèle de base d'une commande (ou celui d'un autre uid, si l'admin en change). */
export async function fetchBase(id: string, uid?: string): Promise<BaseRecord> {
  const demande = await readDemande(id);
  if (!demande) throw new Error("Demande introuvable");
  const existing = await readBase(id);
  if (existing?.status === "running" && !stale(existing)) return existing;

  const b = demande.base;
  const garage = !uid && b?.car ? cars.find((c) => c.slug === b.car) : undefined;
  if (garage?.glb)
    // Fichier public du site : le navigateur de l'admin le copie dans la commande (le serveur ne peut pas le lire en aperçu protégé).
    return saveBase(id, { status: "done", startedAt: new Date().toISOString(), source: "garage", label: `${garage.make} ${garage.model}`, glb: garage.glb });

  const target = uid ?? b?.uid;
  const r: BaseRecord = { status: "running", startedAt: new Date().toISOString(), source: "sketchfab", label: b?.label ?? demande.car, uid: target };
  if (!target) return saveBase(id, { ...r, status: "error", error: "Le client n'a pas choisi de modèle Sketchfab : colle l'adresse d'un modèle ou dépose un .glb." });
  await saveBase(id, r);
  try {
    const info = await model(target);
    r.label = info.name;
    r.author = info.author;
    r.licence = info.licence;
    if (!licenceOk(info.licence)) throw new Error(`Licence « ${info.licence} » : elle interdit la vente. Choisis un autre modèle.`);
    const file = await download(target);
    const res = await fetch(file.url);
    if (!res.ok) throw new Error(`Téléchargement Sketchfab : ${res.status}`);
    let bytes: Uint8Array = new Uint8Array(await res.arrayBuffer());
    if (file.zip) bytes = await zipToGlb(bytes);
    const blob = await put(`submissions/${id}/base.glb`, Buffer.from(bytes), {
      access: BLOB_ACCESS,
      contentType: "model/gltf-binary",
      addRandomSuffix: false,
      allowOverwrite: true,
      multipart: bytes.byteLength > 20 * 1024 * 1024,
    });
    r.glb = blob.pathname;
    r.sizeMb = Math.round(bytes.byteLength / 1e5) / 10;
    r.status = "done";
  } catch (e) {
    r.status = "error";
    r.error = (e as Error).message;
  }
  return saveBase(id, r);
}
