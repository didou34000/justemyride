"use client";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/**
 * Rend 4 vues fixes d'un GLB (avant, gauche, arrière, droite) dans le navigateur,
 * pour que Claude compare le modèle Meshy aux photos. Vercel ne sait pas faire de rendu 3D.
 * Meshy oriente la voiture le long de son axe le plus long : on cadre d'après la boîte englobante.
 */
export async function renderViews(src: string, size = 768): Promise<string[]> {
  const gltf = await new GLTFLoader().loadAsync(src);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size);
  renderer.setClearColor(0xffffff);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const model = gltf.scene;
  const grey = new THREE.MeshStandardMaterial({ color: 0x9a958d, roughness: 0.55, metalness: 0.1 });
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.material = grey;
  });
  const box = new THREE.Box3().setFromObject(model);
  model.position.sub(box.getCenter(new THREE.Vector3()));
  scene.add(model);
  const dim = box.getSize(new THREE.Vector3());
  // Axe de la longueur : X ou Z, le plus grand des deux.
  const alongX = dim.x >= dim.z;
  const r = dim.length() * 1.15;
  const camera = new THREE.PerspectiveCamera(30, 1, r / 100, r * 10);
  const h = dim.y * 0.25;
  const dirs = alongX
    ? [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1)]
    : [new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0)];
  const out: string[] = [];
  for (const d of dirs) {
    // Un peu de biais (3/4) et de hauteur : on voit mieux les badges et les feux qu'en vue plate.
    const side = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(0.35);
    camera.position.copy(d.clone().add(side).normalize().multiplyScalar(r * 1.45)).setY(h + r * 0.3);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    out.push(renderer.domElement.toDataURL("image/jpeg", 0.8));
  }
  grey.dispose();
  pmrem.dispose();
  renderer.dispose();
  return out;
}
