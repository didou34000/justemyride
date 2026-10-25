import { readBytes, readJson, writeJson } from "@/lib/blobJson";
import { deletePrefix, putFile } from "@/lib/store";
import { readGlb, slimGlb, writeGlb } from "@/lib/glb";
import { storageEnabled } from "@/lib/storage";
import { devinerSorte, FOURNIES, isSorte, type Element } from "@/lib/bibliothequeShared";
import type { PieceJob } from "@/lib/meshyShared";

/**
 * Bibliothèque des éléments 3D (voir lib/bibliothequeShared.ts). Les fichiers vivent dans le stockage sous bibliotheque/,
 * à part des commandes : « Effacer toutes les demandes » n'y touche pas. Meshy ne garde ses modèles que 3 jours
 * (docs.meshy.ai/api/asset-retention) : c'est notre copie qui compte. Chaque fichier est allégé (meshopt + textures WebP).
 */

const INDEX = "bibliotheque/index.json";
type Index = {
  elements: Element[];
  /** Modifications des pièces fournies avec le site (nom, voitures…) et celles qu'on a retirées. */
  modifs?: Record<string, Partial<Element>>;
  masques?: string[];
};

const readIndex = async (): Promise<Index> => (storageEnabled() ? await readJson<Index>(INDEX).catch(() => null) : null) ?? { elements: [] };

/** Toutes les pièces, les plus récentes d'abord, puis celles fournies avec le site. */
export async function listElements() {
  const idx = await readIndex();
  const fournies = FOURNIES.filter((e) => !idx.masques?.includes(e.id)).map((e) => ({ ...e, ...idx.modifs?.[e.id] }));
  return [...[...idx.elements].sort((a, b) => b.ajouteLe.localeCompare(a.ajouteLe)), ...fournies];
}

export async function getElement(id: string) {
  return (await listElements()).find((e) => e.id === id) ?? null;
}

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "piece";
const newId = (nom: string) => `${slug(nom)}-${crypto.randomUUID().slice(0, 6)}`;

/** Copie un fichier du stockage dans la bibliothèque ; un .glb est allégé au passage s'il ne l'est pas déjà. */
async function copyIn(from: string, to: string) {
  const { data, type } = await readBytes(from);
  let bytes: Uint8Array = data;
  if (to.endsWith(".glb")) {
    // Déjà compressé (pièces Meshy) : on le garde tel quel, le recompresser n'apporterait rien.
    const deja = data.includes(Buffer.from("EXT_meshopt_compression"));
    if (!deja) bytes = await writeGlb(await slimGlb(await readGlb(data)));
  }
  await putFile(to, bytes, to.endsWith(".glb") ? "model/gltf-binary" : type);
  return { pathname: to, octets: bytes.byteLength };
}

/**
 * Range une pièce 3D Meshy réussie d'une commande (appelé tout seul quand Meshy la livre).
 * Une même pièce n'est rangée qu'une fois.
 */
export async function addFromJob(demande: string, n: number, job: PieceJob, voiture: string) {
  if (!job.glb || job.bibliotheque) return null;
  const idx = await readIndex();
  if (idx.elements.some((e) => e.depuis?.demande === demande && e.depuis.job === n)) return null;
  const id = newId(job.piece);
  const glb = await copyIn(job.glb, `bibliotheque/${id}.glb`);
  const apercu = job.thumb ? await copyIn(job.thumb, `bibliotheque/${id}.png`).catch(() => null) : null;
  const e: Element = {
    id,
    nom: job.piece.charAt(0).toUpperCase() + job.piece.slice(1),
    sorte: devinerSorte(job.piece, job.type),
    voitures: voiture ? [voiture] : [],
    origine: "meshy",
    glb: glb.pathname,
    apercu: apercu?.pathname,
    octets: glb.octets,
    credits: job.credits,
    depuis: { demande, job: n },
    ajouteLe: new Date().toISOString(),
  };
  // Relu juste avant d'écrire : deux pièces livrées en même temps ne s'écrasent pas.
  const fresh = await readIndex();
  fresh.elements.push(e);
  await writeJson(INDEX, fresh);
  return e;
}

/** Ajoute un .glb déposé depuis la page Bibliothèque (pièce faite dans Blender, trouvée ailleurs…). */
export async function addUploaded(pathname: string, champs: { nom?: unknown; sorte?: unknown; voitures?: unknown }) {
  if (!/^bibliotheque\/depot\/[\w.-]+\.glb$/.test(pathname)) throw new Error("Fichier refusé");
  const nom = typeof champs.nom === "string" && champs.nom.trim() ? champs.nom.trim().slice(0, 80) : "Pièce sans nom";
  const id = newId(nom);
  const glb = await copyIn(pathname, `bibliotheque/${id}.glb`);
  // Le dépôt brut (parfois très lourd) n'est pas gardé : seule la version allégée compte.
  await deletePrefix(pathname).catch(() => 0);
  const e: Element = {
    id,
    nom,
    sorte: isSorte(champs.sorte) ? champs.sorte : devinerSorte(nom),
    voitures: voituresDe(champs.voitures),
    origine: "fichier",
    glb: glb.pathname,
    octets: glb.octets,
    ajouteLe: new Date().toISOString(),
  };
  const idx = await readIndex();
  idx.elements.push(e);
  await writeJson(INDEX, idx);
  return e;
}

const voituresDe = (v: unknown) =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [])
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 12);

/** Renomme, change la sorte, les voitures ou le rappel d'une pièce. */
export async function updateElement(id: string, champs: { nom?: unknown; sorte?: unknown; voitures?: unknown; attention?: unknown }) {
  const patch: Partial<Element> = {};
  if (typeof champs.nom === "string" && champs.nom.trim()) patch.nom = champs.nom.trim().slice(0, 80);
  if (isSorte(champs.sorte)) patch.sorte = champs.sorte;
  if (champs.voitures !== undefined) patch.voitures = voituresDe(champs.voitures);
  if (typeof champs.attention === "string") patch.attention = champs.attention.trim().slice(0, 200) || undefined;
  const idx = await readIndex();
  const e = idx.elements.find((x) => x.id === id);
  if (e) Object.assign(e, patch);
  else if (FOURNIES.some((x) => x.id === id)) idx.modifs = { ...idx.modifs, [id]: { ...idx.modifs?.[id], ...patch } };
  else throw new Error("Pièce introuvable");
  await writeJson(INDEX, idx);
}

/** Retire une pièce (et ses fichiers). Une pièce fournie avec le site est seulement masquée. */
export async function removeElement(id: string) {
  const idx = await readIndex();
  const e = idx.elements.find((x) => x.id === id);
  if (e) {
    idx.elements = idx.elements.filter((x) => x.id !== id);
    await deletePrefix(`bibliotheque/${id}.`).catch(() => 0);
  } else if (FOURNIES.some((x) => x.id === id)) idx.masques = [...new Set([...(idx.masques ?? []), id])];
  else throw new Error("Pièce introuvable");
  await writeJson(INDEX, idx);
}
