"use client";

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

/**
 * Rendus d'un GLB dans le navigateur de l'admin, pour que Claude regarde le modèle (Vercel ne sait pas faire de 3D).
 * - renderViews : 4 vues en 3/4 autour de la voiture ;
 * - renderHighlights : pour chaque matériau principal, une image où il est en rouge et le reste en gris.
 * On cadre d'après la boîte englobante : la longueur de la voiture est son axe X ou Z le plus long.
 */

async function stage(src: string, size: number) {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(src);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size);
  renderer.setClearColor(0xffffff);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  model.position.sub(box.getCenter(new THREE.Vector3()));
  scene.add(model);
  const dim = box.getSize(new THREE.Vector3());
  const alongX = dim.x >= dim.z;
  const r = dim.length() * 1.15;
  const camera = new THREE.PerspectiveCamera(30, 1, r / 100, r * 10);
  const dirs = alongX
    ? [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1)]
    : [new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0)];
  const shoot = (d: THREE.Vector3) => {
    // Un peu de biais (3/4) et de hauteur : on voit mieux la caisse, les badges et les feux qu'en vue plate.
    const side = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(0.35);
    camera.position.copy(d.clone().add(side).normalize().multiplyScalar(r * 1.2)).setY(dim.y * 0.25 + r * 0.3);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    return renderer.domElement;
  };
  const dispose = () => {
    pmrem.dispose();
    renderer.dispose();
  };
  return { gltf, model, dirs, shoot, dispose };
}

/** colors = false : tout en gris pour juger les volumes ; true : les matériaux du fichier. */
export async function renderViews(src: string, { colors = true, size = 768 } = {}): Promise<string[]> {
  const s = await stage(src, size);
  const grey = new THREE.MeshStandardMaterial({ color: 0x9a958d, roughness: 0.55, metalness: 0.1 });
  if (!colors)
    s.model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = grey;
    });
  const out = s.dirs.map((d) => s.shoot(d).toDataURL("image/jpeg", 0.8));
  grey.dispose();
  s.dispose();
  return out;
}

/** Repère du matériau d'un mesh dans le fichier (m0, m1…) : le même que côté serveur. */
function matIndex(gltf: GLTF, mat: THREE.Material) {
  const a = gltf.parser.associations.get(mat) as { materials?: number } | undefined;
  return a?.materials;
}

/**
 * Pour les matériaux qui couvrent le plus de triangles (max), une image 512×256 :
 * le matériau en rouge, le reste en gris, vu en 3/4 avant et en 3/4 arrière.
 */
export async function renderHighlights(src: string, max = 40): Promise<{ id: string; image: string }[]> {
  const half = 256;
  const s = await stage(src, half);
  const groups = new Map<number, { meshes: THREE.Mesh[]; tris: number }>();
  const original = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  s.model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    const i = matIndex(s.gltf, m.material);
    if (i === undefined) return;
    const g = groups.get(i) ?? { meshes: [], tris: 0 };
    g.meshes.push(m);
    const geo = m.geometry;
    g.tris += (geo.index?.count ?? geo.attributes.position?.count ?? 0) / 3;
    groups.set(i, g);
    original.set(m, m.material);
  });
  const grey = new THREE.MeshStandardMaterial({ color: 0xd4d0c8, roughness: 0.7 });
  const red = new THREE.MeshStandardMaterial({ color: 0xff1a1a, emissive: 0x991010, roughness: 0.5 });
  const all = [...original.keys()];
  const canvas = document.createElement("canvas");
  canvas.width = half * 2;
  canvas.height = half;
  const ctx = canvas.getContext("2d")!;
  const out: { id: string; image: string }[] = [];
  const top = [...groups.entries()].sort((a, b) => b[1].tris - a[1].tris).slice(0, max);
  for (const [i, g] of top) {
    for (const m of all) m.material = grey;
    for (const m of g.meshes) m.material = red;
    ctx.drawImage(s.shoot(s.dirs[0]), 0, 0);
    ctx.drawImage(s.shoot(s.dirs[2]), half, 0);
    out.push({ id: `m${i}`, image: canvas.toDataURL("image/jpeg", 0.75) });
  }
  for (const [m, mat] of original) m.material = mat;
  grey.dispose();
  red.dispose();
  s.dispose();
  return out;
}
