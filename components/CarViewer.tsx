"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { Car } from "@/lib/cars";
import { caliperColors, ORIGINE, wheelColors, type Config } from "@/lib/options";

/*
 * Lecteur 3D du configurateur.
 * Le modèle est chargé une fois, remis à l'échelle (avant vers +Z, sol à y = 0),
 * puis chaque changement de config ne fait que repeindre des matériaux
 * ou remplacer les jantes / sorties d'échappement par des pièces générées ici.
 * Ces pièces sont provisoires : à terme elles viendront d'une bibliothèque de vrais modèles.
 */

type Wheel = { center: THREE.Vector3; radius: number; width: number; side: number };
type Tip = { center: THREE.Vector3; radius: number; rearZ: number };

type Rig = {
  scene: THREE.Scene;
  paint: THREE.Mesh[];
  rims: THREE.Mesh[];
  calipers: THREE.Mesh[];
  exhaust: THREE.Mesh[];
  original: Map<THREE.Mesh, THREE.Material>;
  paintMat: THREE.MeshPhysicalMaterial;
  originalPaint: THREE.Color;
  wheels: Wheel[];
  tips: Tip[];
  rimGroup: THREE.Group;
  exhaustGroup: THREE.Group;
  built: { rims: string; rimColor: string; exhaust: string };
};

const SILVER = "#c9ccd1";

export default function CarViewer({ car, config }: { car: Car; config: Config }) {
  const host = useRef<HTMLDivElement>(null);
  const rig = useRef<Rig | null>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el || !car.glb || !car.roles) return;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(3, 8, 4);
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.55, 0);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 16;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.7;
    controls.addEventListener("start", () => {
      controls.autoRotate = false;
      setTouched(true);
    });

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    // Vue de 3/4 avant ; on recule sur les écrans étroits pour que la voiture rentre.
    const aspect = el.clientWidth / Math.max(el.clientHeight, 1);
    const dist = 7.6 * Math.max(1, 1.1 / aspect);
    camera.position.copy(new THREE.Vector3(0.66, 0.17, 0.73).normalize().multiplyScalar(dist)).add(controls.target);
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    new GLTFLoader().load(
      car.glb,
      (gltf) => {
        if (disposed) return;
        rig.current = setup(scene, gltf.scene, car);
        setReady(true);
      },
      (e) => e.total && setProgress(e.loaded / e.total),
      () => setFailed(true)
    );

    return () => {
      disposed = true;
      ro.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      rig.current = null;
    };
  }, [car]);

  useEffect(() => {
    if (ready && rig.current) apply(rig.current, config);
  }, [ready, config]);

  return (
    <div className="viewer" ref={host}>
      {!ready && (
        <div className="viewer-loading">
          {failed ? "Le modèle 3D n'a pas pu se charger." : `Chargement du modèle 3D… ${Math.round(progress * 100)} %`}
        </div>
      )}
      {ready && !touched && <p className="viewer-hint">Fais glisser pour tourner · pince ou molette pour zoomer</p>}
    </div>
  );
}

/* ---------- préparation du modèle ---------- */

function meshesWith(root: THREE.Object3D, names: string[]) {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && names.includes((m.material as THREE.Material).name)) out.push(m);
  });
  return out;
}

function worldPoints(meshes: THREE.Mesh[]) {
  const pts: THREE.Vector3[] = [];
  for (const m of meshes) {
    m.updateWorldMatrix(true, false);
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
  }
  return pts;
}

function fit(car: THREE.Group, lengthM: number) {
  car.position.set(0, 0, 0);
  car.scale.setScalar(1);
  car.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(car);
  const size = box.getSize(new THREE.Vector3());
  car.scale.setScalar(lengthM / size.z);
  car.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(car);
  const c = box.getCenter(new THREE.Vector3());
  car.position.set(-c.x, -box.min.y, -c.z);
  car.updateMatrixWorld(true);
}

function setup(scene: THREE.Scene, model: THREE.Group, def: Car): Rig {
  const roles = def.roles!;
  const car = new THREE.Group();
  car.add(model);
  scene.add(car);

  // Axe long de la voiture sur Z.
  car.updateMatrixWorld(true);
  const s0 = new THREE.Box3().setFromObject(car).getSize(new THREE.Vector3());
  if (s0.x > s0.z) car.rotation.y = Math.PI / 2;
  fit(car, def.lengthM ?? 4.3);

  // L'échappement est à l'arrière : on veut l'arrière vers -Z, donc l'avant vers +Z.
  const exhaust = meshesWith(model, roles.exhaust);
  const ex = worldPoints(exhaust);
  if (ex.length && ex.reduce((s, p) => s + p.z, 0) / ex.length > 0) {
    car.rotation.y += Math.PI;
    fit(car, def.lengthM ?? 4.3);
  }

  const paint = meshesWith(model, roles.paint);
  const rims = meshesWith(model, roles.rims);
  const calipers = meshesWith(model, roles.calipers);
  const original = new Map<THREE.Mesh, THREE.Material>();
  for (const m of [...paint, ...rims, ...calipers]) original.set(m, m.material as THREE.Material);

  const originalPaint = ((paint[0]?.material as THREE.MeshStandardMaterial)?.color ?? new THREE.Color("#888")).clone();
  const paintMat = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide });
  for (const m of paint) m.material = paintMat;

  // Roues : 4 groupes de points du pneu, selon le côté (x) et l'essieu (z).
  const quad = (pts: THREE.Vector3[]) => {
    const groups = new Map<string, THREE.Vector3[]>();
    for (const p of pts) {
      const k = `${Math.sign(p.x)}${Math.sign(p.z)}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(p);
    }
    return groups;
  };
  const tyreGroups = quad(worldPoints(meshesWith(model, roles.tyres)));
  const rimGroups = quad(worldPoints(rims));
  const wheels: Wheel[] = [];
  for (const [k, pts] of tyreGroups) {
    if (pts.length < 20) continue;
    const tyre = new THREE.Box3().setFromPoints(pts);
    const rim = new THREE.Box3().setFromPoints(rimGroups.get(k) ?? pts);
    const rimSize = rim.getSize(new THREE.Vector3());
    const tyreSize = tyre.getSize(new THREE.Vector3());
    const center = tyre.getCenter(new THREE.Vector3());
    const side = Math.sign(center.x);
    wheels.push({
      center: new THREE.Vector3(side > 0 ? tyre.max.x - tyreSize.x * 0.5 : tyre.min.x + tyreSize.x * 0.5, center.y, center.z),
      radius: Math.min(rimSize.y, rimSize.z) / 2,
      width: tyreSize.x,
      side,
    });
  }

  // Sorties d'échappement : un groupe de points par côté.
  const tips: Tip[] = [];
  for (const side of [-1, 1]) {
    const pts = ex.filter((p) => Math.sign(p.x) === side);
    if (pts.length < 6) continue;
    const box = new THREE.Box3().setFromPoints(pts);
    const size = box.getSize(new THREE.Vector3());
    tips.push({ center: box.getCenter(new THREE.Vector3()), radius: Math.min(size.x, size.y) / 2, rearZ: box.min.z });
  }

  // Ombre douce sous la voiture.
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const g = canvas.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,0.75)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.35)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const box = new THREE.Box3().setFromObject(car).getSize(new THREE.Vector3());
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(box.x * 1.7, box.z * 1.3),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.003;
  scene.add(shadow);

  const rimGroup = new THREE.Group();
  const exhaustGroup = new THREE.Group();
  scene.add(rimGroup, exhaustGroup);

  return {
    scene, paint, rims, calipers, exhaust, original, paintMat, originalPaint,
    wheels, tips, rimGroup, exhaustGroup, built: { rims: "", rimColor: "", exhaust: "" },
  };
}

/* ---------- application de la config ---------- */

function recolor(meshes: THREE.Mesh[], original: Map<THREE.Mesh, THREE.Material>, hex: string | null, tune?: (m: THREE.MeshStandardMaterial) => void) {
  for (const m of meshes) {
    const base = original.get(m)!;
    if (!hex) {
      m.material = base;
      continue;
    }
    const mat = (base as THREE.MeshStandardMaterial).clone();
    mat.color.set(hex);
    tune?.(mat);
    m.material = mat;
  }
}

function clear(group: THREE.Group) {
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.geometry.dispose();
  });
  group.clear();
}

function apply(r: Rig, c: Config) {
  // Peinture
  const p = r.paintMat;
  p.color.copy(c.paint === ORIGINE ? r.originalPaint : new THREE.Color(c.paint));
  const finish = {
    brillant: { metalness: 0.05, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.04 },
    metal: { metalness: 0.65, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.05 },
    mat: { metalness: 0.15, roughness: 0.78, clearcoat: 0, clearcoatRoughness: 0.5 },
  }[c.finish as "brillant" | "metal" | "mat"] ?? { metalness: 0.4, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03 };
  Object.assign(p, finish);
  p.needsUpdate = true;

  // Étriers
  recolor(r.calipers, r.original, caliperColors.find((x) => x.id === c.caliper)?.hex ?? null);

  // Jantes
  const rimHex = wheelColors.find((x) => x.id === c.rimColor)?.hex ?? null;
  const stock = c.rims === ORIGINE;
  for (const m of r.rims) m.visible = stock;
  if (stock) {
    recolor(r.rims, r.original, rimHex, (m) => {
      m.metalness = 0.85;
      m.roughness = 0.3;
    });
  }
  if (r.built.rims !== c.rims || r.built.rimColor !== c.rimColor) {
    clear(r.rimGroup);
    if (!stock) {
      const mat = new THREE.MeshStandardMaterial({
        color: rimHex ?? SILVER, metalness: 0.9, roughness: 0.28, side: THREE.DoubleSide,
      });
      for (const w of r.wheels) r.rimGroup.add(buildRim(c.rims, w, mat));
    }
    r.built.rims = c.rims;
    r.built.rimColor = c.rimColor;
  }

  // Échappement
  const stockEx = c.exhaust === ORIGINE;
  for (const m of r.exhaust) m.visible = stockEx;
  if (r.built.exhaust !== c.exhaust) {
    clear(r.exhaustGroup);
    if (!stockEx) for (const t of r.tips) r.exhaustGroup.add(buildExhaust(c.exhaust, t));
    r.built.exhaust = c.exhaust;
  }
}

/* ---------- pièces provisoires ---------- */

const dark = new THREE.MeshStandardMaterial({ color: "#0b0b0c", roughness: 0.6, side: THREE.DoubleSide });
const chrome = new THREE.MeshStandardMaterial({ color: "#dcdcdc", metalness: 1, roughness: 0.14, side: THREE.DoubleSide });

/** Jante construite autour de l'axe X, face extérieure vers +X, puis tournée selon le côté. */
function buildRim(style: string, w: Wheel, mat: THREE.Material) {
  const R = w.radius * 0.97;
  const W = w.width * 0.8;
  const face = W / 2;
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.x = x;
    g.add(mesh);
    return mesh;
  };

  add(new THREE.CylinderGeometry(R, R, W, 48, 1, true).rotateZ(Math.PI / 2), mat);
  add(new THREE.TorusGeometry(R * 0.985, R * 0.04, 10, 64).rotateY(Math.PI / 2), mat, face);
  add(new THREE.CylinderGeometry(R * 0.2, R * 0.26, W * 0.3, 32).rotateZ(-Math.PI / 2), mat, face - W * 0.15);
  add(new THREE.CylinderGeometry(R * 0.11, R * 0.11, 0.01, 24).rotateZ(Math.PI / 2), dark, face + 0.002);

  const spoke = (angle: number, width: number, depth: number, twist = 0) => {
    const len = R * 0.8;
    const geo = new THREE.BoxGeometry(depth, len, width);
    geo.rotateY(twist);
    geo.translate(0, R * 0.18 + len / 2, 0);
    geo.rotateX(angle);
    add(geo, mat, face - depth / 2 - 0.004);
  };
  const deg = Math.PI / 180;
  if (style === "cinq") {
    for (let k = 0; k < 5; k++) for (const d of [-7, 7]) spoke((k * 72 + d) * deg, R * 0.12, W * 0.16);
  } else if (style === "multi") {
    for (let k = 0; k < 15; k++) spoke(k * 24 * deg, R * 0.07, W * 0.12);
  } else {
    add(new THREE.CircleGeometry(R * 0.98, 48).rotateY(Math.PI / 2), dark, face - W * 0.28);
    for (let k = 0; k < 18; k++) spoke(k * 20 * deg, R * 0.16, W * 0.04, 38 * deg);
  }

  g.position.copy(w.center);
  if (w.side < 0) g.rotation.y = Math.PI;
  return g;
}

/** Sortie construite le long de Z, bord visible à z = 0, qui rentre dans le pare-chocs vers +Z. */
function buildExhaust(style: string, t: Tip) {
  const g = new THREE.Group();
  const len = 0.12;
  const tube = (r: number, x: number) => {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 40, 1, true).rotateX(Math.PI / 2).translate(0, 0, len / 2), chrome);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.07, 8, 40), chrome);
    const back = new THREE.Mesh(new THREE.CircleGeometry(r * 0.96, 32).translate(0, 0, 0.06), dark);
    for (const m of [body, lip, back]) {
      m.position.x = x;
      g.add(m);
    }
  };
  const r = t.radius;
  if (style === "xl") tube(r * 1.45, 0);
  else if (style === "double") {
    tube(r * 0.95, -r * 1.05);
    tube(r * 0.95, r * 1.05);
  } else {
    const hw = r * 1.9;
    const hh = r * 1.1;
    const outer = roundRect(hw, hh, r * 0.45);
    outer.holes.push(roundRect(hw - r * 0.16, hh - r * 0.16, r * 0.35));
    g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: len, bevelEnabled: false, curveSegments: 8 }), chrome));
    const back = new THREE.Mesh(new THREE.ShapeGeometry(roundRect(hw - r * 0.1, hh - r * 0.1, r * 0.35)).translate(0, 0, 0.06), dark);
    g.add(back);
  }
  g.position.set(t.center.x, t.center.y, t.rearZ - 0.025);
  return g;
}

function roundRect(hw: number, hh: number, rad: number) {
  const s = new THREE.Shape();
  s.moveTo(-hw + rad, -hh);
  s.lineTo(hw - rad, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + rad);
  s.lineTo(hw, hh - rad);
  s.quadraticCurveTo(hw, hh, hw - rad, hh);
  s.lineTo(-hw + rad, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - rad);
  s.lineTo(-hw, -hh + rad);
  s.quadraticCurveTo(-hw, -hh, -hw + rad, -hh);
  return s;
}
