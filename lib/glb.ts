import { NodeIO, type Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { unzipSync } from "fflate";

/**
 * Lecture et écriture des modèles 3D côté serveur, sans Blender (Vercel ne le fait pas tourner).
 * On ne touche jamais à la géométrie ici : seulement aux matériaux.
 */

async function io() {
  await MeshoptDecoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
}

/** Les modèles compressés (meshopt) sont décompressés à la lecture : on les réécrit sans compression. */
function dropCompression(doc: Document) {
  for (const e of doc.getRoot().listExtensionsUsed())
    if (e.extensionName === "EXT_meshopt_compression" || e.extensionName === "KHR_draco_mesh_compression") e.dispose();
}

export async function readGlb(bytes: Uint8Array) {
  const doc = await (await io()).readBinary(bytes);
  dropCompression(doc);
  return doc;
}

export async function writeGlb(doc: Document) {
  return (await io()).writeBinary(doc);
}

/** Archive .zip de Sketchfab (scene.gltf + scene.bin + textures) → un seul .glb. */
export async function zipToGlb(zip: Uint8Array) {
  const files = unzipSync(zip);
  const gltfPath = Object.keys(files).find((p) => p.toLowerCase().endsWith(".gltf"));
  if (!gltfPath) throw new Error("Archive Sketchfab sans fichier .gltf");
  const dir = gltfPath.includes("/") ? gltfPath.slice(0, gltfPath.lastIndexOf("/") + 1) : "";
  const resources: Record<string, Uint8Array<ArrayBuffer>> = {};
  for (const [p, data] of Object.entries(files)) {
    if (p === gltfPath || !p.startsWith(dir)) continue;
    const rel = p.slice(dir.length);
    resources[rel] = data as Uint8Array<ArrayBuffer>;
    // Les chemins du .gltf sont parfois encodés (espaces → %20).
    resources[encodeURI(rel)] = data as Uint8Array<ArrayBuffer>;
  }
  const json = JSON.parse(new TextDecoder().decode(files[gltfPath]));
  const doc = await (await io()).readJSON({ json, resources });
  dropCompression(doc);
  return writeGlb(doc);
}

export type MatInfo = {
  /** Repère stable : l'ordre des matériaux dans le fichier (m0, m1…), le même que dans le navigateur. */
  id: string;
  name: string;
  triangles: number;
  /** Couleur actuelle (hex) et présence d'une texture de couleur. */
  color: string;
  texture: boolean;
  transparent: boolean;
};

const toHex = (c: number[]) =>
  "#" +
  c
    .slice(0, 3)
    .map((v) => Math.round(Math.min(1, Math.max(0, linToSrgb(v))) * 255).toString(16).padStart(2, "0"))
    .join("");
const linToSrgb = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
const srgbToLin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** La liste des matériaux, avec combien de triangles chacun couvre (pour savoir lesquels comptent). */
export function materialTable(doc: Document): MatInfo[] {
  const mats = doc.getRoot().listMaterials();
  const tris = new Map(mats.map((m) => [m, 0]));
  for (const mesh of doc.getRoot().listMeshes())
    for (const p of mesh.listPrimitives()) {
      const m = p.getMaterial();
      if (!m) continue;
      const n = p.getIndices()?.getCount() ?? p.getAttribute("POSITION")?.getCount() ?? 0;
      tris.set(m, (tris.get(m) ?? 0) + Math.round(n / 3));
    }
  return mats.map((m, i) => ({
    id: `m${i}`,
    name: m.getName() || `matériau ${i}`,
    triangles: tris.get(m) ?? 0,
    color: toHex(m.getBaseColorFactor()),
    texture: Boolean(m.getBaseColorTexture()),
    transparent: m.getAlphaMode() === "BLEND" || m.getBaseColorFactor()[3] < 1,
  }));
}

/** Finitions possibles et leur réglage (rugosité, métal, opacité). */
export const FINITIONS = {
  brillant: { roughness: 0.2, metallic: 0 },
  satine: { roughness: 0.42, metallic: 0 },
  mat: { roughness: 0.78, metallic: 0 },
  metallise: { roughness: 0.32, metallic: 0.55 },
  chrome: { roughness: 0.1, metallic: 1 },
  alu: { roughness: 0.35, metallic: 1 },
  plastique: { roughness: 0.6, metallic: 0 },
  caoutchouc: { roughness: 0.92, metallic: 0 },
  verre: { roughness: 0.05, metallic: 0, alpha: 0.45 },
  verre_teinte: { roughness: 0.05, metallic: 0, alpha: 0.82 },
  feu: { roughness: 0.15, metallic: 0, alpha: 0.88 },
} as const;
export type Finition = keyof typeof FINITIONS;

export type Paint = { id: string; couleur: string; finition: Finition };

/**
 * Repeint les matériaux listés (couleur unie + finition) et laisse tous les autres tels quels.
 * La texture de couleur d'un matériau repeint est retirée (sinon elle se mélange à la nouvelle teinte) ;
 * les reliefs (normal map) restent. Renvoie les repères appliqués.
 */
export function repaint(doc: Document, paints: Paint[]) {
  const mats = doc.getRoot().listMaterials();
  const done: string[] = [];
  for (const p of paints) {
    const m = mats[Number(p.id.slice(1))];
    const hex = p.couleur.match(/^#?([0-9a-f]{6})$/i)?.[1];
    if (!m || !hex) continue;
    const f = FINITIONS[p.finition] ?? FINITIONS.satine;
    const rgb = [0, 2, 4].map((i) => srgbToLin(parseInt(hex.slice(i, i + 2), 16) / 255));
    const alpha = "alpha" in f ? f.alpha : 1;
    m.setBaseColorFactor([rgb[0], rgb[1], rgb[2], alpha]);
    m.setBaseColorTexture(null);
    m.setMetallicRoughnessTexture(null);
    m.setRoughnessFactor(f.roughness);
    m.setMetallicFactor(f.metallic);
    m.setAlphaMode(alpha < 1 ? "BLEND" : "OPAQUE");
    // L'ancien mode « spéculaire » de certains modèles Sketchfab ignorerait la nouvelle couleur.
    m.setExtension("KHR_materials_pbrSpecularGlossiness", null);
    if (p.finition !== "feu") {
      m.setEmissiveFactor([0, 0, 0]);
      m.setEmissiveTexture(null);
    }
    done.push(p.id);
  }
  return done;
}
