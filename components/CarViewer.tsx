"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { unzipSync } from "fflate";
import { buildDisplay, disposeDisplay } from "./display";
import { normalizeRim, normalizeTip, placeRims, placeTips, tint, type PartAdjust } from "./partFit";
import { caliperColors, ORIGINE, wheelColors, type Config } from "@/lib/options";

/*
 * Lecteur 3D du configurateur.
 * Le modèle est chargé une fois, remis à l'échelle (avant vers +Z, sol à y = 0),
 * puis chaque changement de config ne fait que repeindre des matériaux
 * ou remplacer les jantes / sorties d'échappement par des pièces générées ici.
 * Ces pièces sont provisoires : à terme elles viendront d'une bibliothèque de vrais modèles.
 *
 * Pour un modèle du catalogue, les rôles (peinture, jantes…) sont donnés.
 * Pour un modèle inconnu (Sketchfab), ils sont devinés, et le client peut corriger en cliquant.
 */

export type Roles = { paint: string[]; rims: string[]; calipers: string[]; exhaust: string[]; tyres: string[] };
export type ModelSource = { url: string; zip?: boolean; lengthM?: number; roles?: Roles };

/** Noms posés par tools/prepare_car.py sur un modèle préparé (« standard »). */
const STANDARD: Roles = {
  paint: ["JMR_Paint"], rims: ["JMR_Rim"], calipers: ["JMR_Caliper"], exhaust: ["JMR_Exhaust"], tyres: ["JMR_Tyre"],
};
/** Ce que le modèle permet de personnaliser. */
export type Caps = { paint: boolean; rims: boolean; rimStyles: boolean; calipers: boolean; exhaust: boolean };
export type PickRole = "paint" | "rims" | "calipers";

type Wheel = { center: THREE.Vector3; radius: number; tyreRadius: number; width: number; side: number };
/** Pièce Sketchfab choisie par le client (jante ou sortie d'échappement). */
export type PartChoice = { url: string; zip?: boolean; adjust: PartAdjust };
export const SKETCHFAB = "sketchfab";
type Tip = { center: THREE.Vector3; radius: number; rearZ: number };
type Mat = THREE.MeshStandardMaterial;

type Rig = {
  scene: THREE.Scene;
  meshes: THREE.Mesh[];
  original: Map<THREE.Mesh, Mat>;
  roles: Record<keyof Roles, Set<Mat>>;
  paintMat: THREE.MeshPhysicalMaterial;
  originalPaint: THREE.Color;
  wheels: Wheel[];
  tips: Tip[];
  rimGroup: THREE.Group;
  exhaustGroup: THREE.Group;
  partRim: THREE.Group;
  partExhaust: THREE.Group;
  hideTyres: boolean;
  /** Dimensions de la voiture, pour le socle et la vitrine. */
  size: THREE.Vector3;
  display: THREE.Group | null;
  built: { rims: string; rimColor: string; exhaust: string };
};

const SILVER = "#c9ccd1";

export default function CarViewer({
  source,
  config,
  pick,
  onCaps,
  onPicked,
  parts,
  onPartStatus,
  framing = 1,
  interactive = true,
  zoom = true,
}: {
  source: ModelSource;
  config: Config;
  pick?: PickRole | null;
  onCaps?: (c: Caps) => void;
  onPicked?: () => void;
  parts?: { rim?: PartChoice | null; exhaust?: PartChoice | null };
  /** "" = posée, "loading", ou un message d'erreur. */
  onPartStatus?: (kind: "rim" | "exhaust", status: string) => void;
  /** > 1 recule la caméra (aperçu plus petit, plus de décor). */
  framing?: number;
  /** false : la voiture tourne seule, sans capter la souris (la page défile normalement). */
  interactive?: boolean;
  /** false : pas de zoom à la molette ou au pincement, pour laisser la page défiler. */
  zoom?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const rig = useRef<Rig | null>(null);
  const configRef = useRef(config);
  const pickRef = useRef(pick);
  const cb = useRef({ onCaps, onPicked, onPartStatus });
  const partCache = useRef(new Map<string, Promise<THREE.Group>>());
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState("");
  const [touched, setTouched] = useState(false);
  configRef.current = config;
  pickRef.current = pick;
  cb.current = { onCaps, onPicked, onPartStatus };

  useEffect(() => {
    const el = host.current;
    if (!el) return;
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
    controls.target.set(0, 0.4, 0);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enabled = interactive;
    controls.enableZoom = zoom;
    controls.minDistance = 4;
    controls.maxDistance = 16 * framing;
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
    const dist = 7.6 * framing * Math.max(1, 1.1 / aspect);
    camera.position.copy(new THREE.Vector3(0.66, 0.17, 0.73).normalize().multiplyScalar(dist)).add(controls.target);
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    // Clic (sans glisser) sur une pièce quand le client corrige un rôle.
    const down = new THREE.Vector2();
    const onDown = (e: PointerEvent) => down.set(e.clientX, e.clientY);
    const onUp = (e: PointerEvent) => {
      const role = pickRef.current;
      const r = rig.current;
      if (!role || !r || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(r.meshes.filter((m) => m.visible), false)[0];
      if (!hit) return;
      setRole(r, role, r.original.get(hit.object as THREE.Mesh)!);
      apply(r, configRef.current, true);
      cb.current.onCaps?.(caps(r));
      cb.current.onPicked?.();
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    load(source, setProgress)
      .then((model) => {
        if (disposed) return;
        const r = setup(scene, model, source);
        rig.current = r;
        apply(r, configRef.current);
        cb.current.onCaps?.(caps(r));
        setReady(true);
      })
      .catch((e: Error) => !disposed && setFailed(e.message || "erreur inconnue"));

    return () => {
      disposed = true;
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.setAnimationLoop(null);
      controls.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      rig.current = null;
    };
  }, [source]);

  useEffect(() => {
    if (ready && rig.current) apply(rig.current, config);
  }, [ready, config]);

  // Socle, étagère et vitrine : reconstruits seulement quand les finitions changent.
  const socle = config.accessories.includes("socle");
  const vitrine = config.accessories.includes("vitrine");
  useEffect(() => {
    const r = rig.current;
    if (!ready || !r) return;
    if (r.display) {
      r.scene.remove(r.display);
      disposeDisplay(r.display);
    }
    r.display = buildDisplay(r.size, { socle, vitrine, label: config.carName });
    r.scene.add(r.display);
  }, [ready, socle, vitrine, config.carName]);

  const getPart = (p: PartChoice) => {
    let pr = partCache.current.get(p.url);
    if (!pr) {
      pr = load({ url: p.url, zip: p.zip }, () => {});
      partCache.current.set(p.url, pr);
      pr.catch(() => partCache.current.delete(p.url));
    }
    return pr;
  };

  // Jante Sketchfab : chargée une fois, puis posée sur les 4 roues.
  const rimKey = parts?.rim ? JSON.stringify(parts.rim) : "";
  useEffect(() => {
    const r = rig.current;
    const choice = parts?.rim;
    if (!ready || !r) return;
    r.partRim.clear();
    r.hideTyres = false;
    apply(r, configRef.current);
    if (!choice) return;
    let cancelled = false;
    cb.current.onPartStatus?.("rim", "loading");
    getPart(choice)
      .then((scene) => {
        if (cancelled) return;
        const n = normalizeRim(scene.clone(true), choice.adjust);
        if (typeof n === "string") return cb.current.onPartStatus?.("rim", n);
        placeRims(n, r.wheels, choice.adjust, r.partRim);
        tint(r.partRim, wheelColors.find((x) => x.id === configRef.current.rimColor)?.hex ?? null);
        r.hideTyres = !!n.fullWheel;
        apply(r, configRef.current);
        cb.current.onPartStatus?.("rim", "");
      })
      .catch((e: Error) => !cancelled && cb.current.onPartStatus?.("rim", `téléchargement impossible (${e.message})`));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, rimKey, config.rimColor]);

  // Sortie d'échappement Sketchfab : posée sur chaque sortie d'origine.
  const exKey = parts?.exhaust ? JSON.stringify(parts.exhaust) : "";
  useEffect(() => {
    const r = rig.current;
    const choice = parts?.exhaust;
    if (!ready || !r) return;
    r.partExhaust.clear();
    if (!choice) return;
    let cancelled = false;
    cb.current.onPartStatus?.("exhaust", "loading");
    getPart(choice)
      .then((scene) => {
        if (cancelled) return;
        const n = normalizeTip(scene.clone(true), choice.adjust);
        if (typeof n === "string") return cb.current.onPartStatus?.("exhaust", n);
        placeTips(n, r.tips, choice.adjust, r.partExhaust);
        apply(r, configRef.current);
        cb.current.onPartStatus?.("exhaust", "");
      })
      .catch((e: Error) => !cancelled && cb.current.onPartStatus?.("exhaust", `téléchargement impossible (${e.message})`));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, exKey]);

  return (
    <div className={`viewer ${pick ? "picking" : ""}`} ref={host}>
      {!ready && (
        <div className="viewer-loading">
          {failed ? `Le modèle 3D n'a pas pu se charger (${failed}).` : `Chargement du modèle 3D… ${Math.round(progress * 100)} %`}
        </div>
      )}
      {ready && interactive && !touched && !pick && <p className="viewer-hint">{zoom ? "Fais glisser pour tourner · pince ou molette pour zoomer" : "Fais-la tourner"}</p>}
    </div>
  );
}

/* ---------- chargement (GLB, ou glTF en zip comme le fournit Sketchfab) ---------- */

async function fetchBuffer(url: string, onProgress: (p: number) => void) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`téléchargement ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    if (total) onProgress(got / total);
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

async function load(source: ModelSource, onProgress: (p: number) => void): Promise<THREE.Group> {
  const data = await fetchBuffer(source.url, onProgress);
  const manager = new THREE.LoadingManager();
  const loader = new GLTFLoader(manager);
  const blobs: string[] = [];
  let input: ArrayBuffer | string = data.buffer as ArrayBuffer;

  if (source.zip) {
    const files = unzipSync(data);
    const gltfPath = Object.keys(files).find((p) => p.toLowerCase().endsWith(".gltf"));
    const glbPath = Object.keys(files).find((p) => p.toLowerCase().endsWith(".glb"));
    if (glbPath) input = files[glbPath].slice().buffer as ArrayBuffer;
    else if (gltfPath) {
      const dir = gltfPath.includes("/") ? gltfPath.slice(0, gltfPath.lastIndexOf("/") + 1) : "";
      const urls = new Map<string, string>();
      for (const [p, bytes] of Object.entries(files)) {
        if (!p.startsWith(dir) || p.endsWith("/")) continue;
        const u = URL.createObjectURL(new Blob([bytes.slice()]));
        blobs.push(u);
        urls.set(p.slice(dir.length), u);
      }
      manager.setURLModifier((u) => urls.get(decodeURIComponent(u).replace(/^\.\//, "")) ?? u);
      input = new TextDecoder().decode(files[gltfPath]);
    } else throw new Error("archive sans fichier glTF");
  }

  try {
    const gltf = await loader.parseAsync(input, "");
    return gltf.scene;
  } finally {
    // Les textures sont décodées une fois le parse fini ; on libère les blobs un peu après.
    setTimeout(() => blobs.forEach((u) => URL.revokeObjectURL(u)), 10_000);
  }
}

/* ---------- préparation du modèle ---------- */

function worldPoints(meshes: THREE.Mesh[]) {
  const pts: THREE.Vector3[] = [];
  for (const m of meshes) {
    m.updateWorldMatrix(true, false);
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
  }
  return pts;
}

function boxOf(objs: THREE.Object3D[]) {
  const b = new THREE.Box3();
  for (const o of objs) b.expandByObject(o);
  return b;
}

function fit(car: THREE.Group, meshes: THREE.Mesh[], lengthM: number) {
  car.position.set(0, 0, 0);
  car.scale.setScalar(1);
  car.updateMatrixWorld(true);
  let box = boxOf(meshes);
  car.scale.setScalar(lengthM / box.getSize(new THREE.Vector3()).z);
  car.updateMatrixWorld(true);
  box = boxOf(meshes);
  const c = box.getCenter(new THREE.Vector3());
  car.position.set(-c.x, -box.min.y, -c.z);
  car.updateMatrixWorld(true);
}

function setup(scene: THREE.Scene, model: THREE.Group, source: ModelSource): Rig {
  const car = new THREE.Group();
  car.add(model);
  scene.add(car);
  car.updateMatrixWorld(true);

  const meshes: THREE.Mesh[] = [];
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !Array.isArray(m.material)) meshes.push(m);
  });

  // Beaucoup de modèles Sketchfab ont un sol ou un fond : une grande pièce plate qui fausse l'échelle.
  const sizeOf = (m: THREE.Mesh) => new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
  const solid = meshes.filter((m) => {
    const s = sizeOf(m);
    return s.y > 0.02 * Math.max(s.x, s.z);
  });
  const body = boxOf(solid.length ? solid : meshes).getSize(new THREE.Vector3());
  for (const m of meshes) {
    if (solid.includes(m)) continue;
    const s = sizeOf(m);
    if (Math.max(s.x, s.z) > 1.2 * Math.max(body.x, body.z)) m.visible = false;
  }
  const kept = meshes.filter((m) => m.visible);

  // Axe long de la voiture sur Z.
  if (body.x > body.z) car.rotation.y = Math.PI / 2;
  const lengthM = source.lengthM ?? 4.3;
  fit(car, kept, lengthM);

  const original = new Map<THREE.Mesh, Mat>();
  for (const m of meshes) original.set(m, m.material as Mat);
  const prepared = meshes.some((m) => (m.material as Mat).name === "JMR_Paint");
  const roles = source.roles ? named(meshes, source.roles) : prepared ? named(meshes, STANDARD) : guess(kept, original);

  // L'échappement est à l'arrière : on veut l'arrière vers -Z, donc l'avant vers +Z.
  const ex = worldPoints(kept.filter((m) => roles.exhaust.has(original.get(m)!)));
  if (ex.length && ex.reduce((s, p) => s + p.z, 0) / ex.length > 0) {
    car.rotation.y += Math.PI;
    fit(car, kept, lengthM);
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
  const size = boxOf(kept).getSize(new THREE.Vector3());
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(size.x * 1.4, size.z * 1.15),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.003;
  scene.add(shadow);

  const rimGroup = new THREE.Group();
  const exhaustGroup = new THREE.Group();
  const partRim = new THREE.Group();
  const partExhaust = new THREE.Group();
  scene.add(rimGroup, exhaustGroup, partRim, partExhaust);

  const r: Rig = {
    scene, meshes: kept, original, roles,
    paintMat: new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide }),
    originalPaint: new THREE.Color("#888"),
    wheels: [], tips: [], rimGroup, exhaustGroup, partRim, partExhaust, hideTyres: false, size, display: null,
    built: { rims: "", rimColor: "", exhaust: "" },
  };
  const paint = [...roles.paint][0];
  if (paint) setRole(r, "paint", paint);
  if (!readAnchors(r, model)) {
    measureWheels(r);
    measureTips(r);
  }
  return r;
}

/** Ancres JMR_Wheel_* / JMR_Exhaust_* d'un modèle préparé : plus fiables que la mesure à la volée. */
function readAnchors(r: Rig, model: THREE.Object3D) {
  const wheels: Wheel[] = [];
  const tips: Tip[] = [];
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    const d = o.userData as { radius?: number; width?: number; tyre_radius?: number };
    if (!d.radius) return;
    const pos = o.getWorldPosition(new THREE.Vector3());
    const scale = o.getWorldScale(new THREE.Vector3()).x;
    if (o.name.startsWith("JMR_Wheel")) {
      wheels.push({
        center: pos, radius: d.radius * scale, tyreRadius: (d.tyre_radius ?? d.radius * 1.3) * scale,
        width: (d.width ?? 0.22) * scale, side: Math.sign(pos.x),
      });
    } else if (o.name.startsWith("JMR_Exhaust")) {
      tips.push({ center: pos, radius: d.radius * scale, rearZ: pos.z });
    }
  });
  if (!wheels.length && !tips.length) return false;
  r.wheels = wheels;
  r.tips = tips;
  r.built.rims = "";
  return true;
}

const emptyRoles = () => ({
  paint: new Set<Mat>(), rims: new Set<Mat>(), calipers: new Set<Mat>(), exhaust: new Set<Mat>(), tyres: new Set<Mat>(),
});

/** Rôles donnés par nom de matériau (modèles du catalogue). */
function named(meshes: THREE.Mesh[], roles: Roles) {
  const out = emptyRoles();
  for (const m of meshes) {
    const mat = m.material as Mat;
    for (const k of Object.keys(roles) as (keyof Roles)[]) if (roles[k].includes(mat.name)) out[k].add(mat);
  }
  return out;
}

const RX = {
  skip: /glass|window|windshield|vitre|verre|light|lamp|phare|feu|interior|int_|seat|siege|dash|steer|volant|plate|plaque|logo|emblem|badge/i,
  tyres: /tyre|tire|pneu|rubber|reifen|gomma|neumat/i,
  calipers: /calip|etrier|étrier|bremssattel/i,
  rims: /\brims?\b|rim[_\d.]|jante|felge|alloy|wheel/i,
  exhaust: /exhaust|muffler|tail_?pipe|echap|échap|auspuff/i,
  paint: /paint|body|lack|carros|exterior|shell|chassis|car_?colou?r/i,
};

function area(m: THREE.Mesh) {
  const pos = m.geometry.attributes.position;
  const idx = m.geometry.index;
  const n = idx ? idx.count : pos.count;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const s = new THREE.Vector3().setFromMatrixScale(m.matrixWorld);
  let sum = 0;
  for (let i = 0; i + 2 < n; i += 3) {
    a.fromBufferAttribute(pos, idx ? idx.getX(i) : i).multiply(s);
    b.fromBufferAttribute(pos, idx ? idx.getX(i + 1) : i + 1).multiply(s);
    c.fromBufferAttribute(pos, idx ? idx.getX(i + 2) : i + 2).multiply(s);
    sum += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return sum;
}

/** Rôles devinés pour un modèle inconnu : d'abord par les noms, sinon la plus grande surface colorée = carrosserie. */
function guess(meshes: THREE.Mesh[], original: Map<THREE.Mesh, Mat>) {
  const out = emptyRoles();
  const paintScore = new Map<Mat, number>();
  for (const m of meshes) {
    const mat = original.get(m)!;
    const label = `${mat.name} ${m.name} ${m.parent?.name ?? ""}`;
    const seeThrough = mat.transparent || mat.opacity < 1 || ((mat as THREE.MeshPhysicalMaterial).transmission ?? 0) > 0;
    if (RX.tyres.test(label)) out.tyres.add(mat);
    else if (RX.calipers.test(label)) out.calipers.add(mat);
    else if (RX.exhaust.test(label)) out.exhaust.add(mat);
    else if (RX.rims.test(label) && !/steer|volant/i.test(label)) out.rims.add(mat);
    else if (!seeThrough && !RX.skip.test(label)) {
      const l = mat.color ? mat.color.getHSL({ h: 0, s: 0, l: 0 }).l : 0.5;
      if (l < 0.06 && !mat.map) continue; // plastiques noirs
      const bonus = RX.paint.test(mat.name) ? (/paint|lack|carros/i.test(mat.name) ? 4 : 2) : 1;
      paintScore.set(mat, (paintScore.get(mat) ?? 0) + area(m) * bonus);
    }
  }
  const best = [...paintScore].sort((a, b) => b[1] - a[1])[0];
  if (best) out.paint.add(best[0]);
  return out;
}

function setRole(r: Rig, role: PickRole, mat: Mat) {
  // Une pièce ne garde qu'un rôle.
  for (const k of ["paint", "rims", "calipers"] as const) if (k !== role) r.roles[k].delete(mat);
  for (const m of r.meshes) if (m.material !== r.original.get(m)) m.material = r.original.get(m)!;
  r.roles[role] = new Set([mat]);

  const paint = [...r.roles.paint][0];
  if (paint) {
    if (role === "paint") r.originalPaint = (mat.color ?? new THREE.Color("#888")).clone();
    const p = r.paintMat;
    p.map = paint.map ?? null;
    p.normalMap = paint.normalMap ?? null;
    p.aoMap = paint.aoMap ?? null;
    p.needsUpdate = true;
    for (const m of r.meshes) if (r.original.get(m) === paint) m.material = p;
  }
  if (role === "rims" && !r.wheels.length) measureWheels(r);
}

function meshesOf(r: Rig, set: Set<Mat>) {
  return r.meshes.filter((m) => set.has(r.original.get(m)!));
}

function measureWheels(r: Rig) {
  // 4 groupes de points, selon le côté (x) et l'essieu (z).
  const quad = (pts: THREE.Vector3[]) => {
    const groups = new Map<string, THREE.Vector3[]>();
    for (const p of pts) {
      const k = `${Math.sign(p.x)}${Math.sign(p.z)}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(p);
    }
    return groups;
  };
  const rimPts = worldPoints(meshesOf(r, r.roles.rims));
  const tyrePts = worldPoints(meshesOf(r, r.roles.tyres));
  const rimGroups = quad(rimPts);
  const base = quad(tyrePts.length ? tyrePts : rimPts);
  const wheels: Wheel[] = [];
  for (const [k, pts] of base) {
    if (pts.length < 20) continue;
    const outer = new THREE.Box3().setFromPoints(pts);
    const rim = new THREE.Box3().setFromPoints(rimGroups.get(k) ?? pts);
    const rimSize = rim.getSize(new THREE.Vector3());
    const radius = Math.min(rimSize.y, rimSize.z) / 2;
    const center = outer.getCenter(new THREE.Vector3());
    // Garde-fou : une « roue » de taille absurde vient d'une mauvaise détection.
    if (radius < 0.12 || radius > 0.5 || center.y > 0.8) continue;
    const outerSize = outer.getSize(new THREE.Vector3());
    wheels.push({ center, radius, tyreRadius: Math.max(outerSize.y, outerSize.z) / 2, width: outerSize.x, side: Math.sign(center.x) });
  }
  r.wheels = wheels.length >= 2 && wheels.length <= 4 ? wheels : [];
  r.built.rims = "";
}

function measureTips(r: Rig) {
  const ex = worldPoints(meshesOf(r, r.roles.exhaust));
  r.tips = [];
  for (const side of [-1, 1]) {
    const pts = ex.filter((p) => Math.sign(p.x) === side);
    if (pts.length < 6) continue;
    const box = new THREE.Box3().setFromPoints(pts);
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.min(size.x, size.y) / 2;
    if (radius > 0.01 && radius < 0.15) r.tips.push({ center: box.getCenter(new THREE.Vector3()), radius, rearZ: box.min.z });
  }
}

function caps(r: Rig): Caps {
  return {
    paint: r.roles.paint.size > 0,
    rims: r.roles.rims.size > 0,
    rimStyles: r.wheels.length > 0,
    calipers: r.roles.calipers.size > 0,
    exhaust: r.tips.length > 0,
  };
}

/* ---------- application de la config ---------- */

function recolor(r: Rig, set: Set<Mat>, hex: string | null, tune?: (m: Mat) => void) {
  for (const m of meshesOf(r, set)) {
    const base = r.original.get(m)!;
    if (!hex) {
      m.material = base;
      continue;
    }
    const mat = base.clone();
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

function apply(r: Rig, c: Config, force = false) {
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
  recolor(r, r.roles.calipers, caliperColors.find((x) => x.id === c.caliper)?.hex ?? null);

  // Jantes
  const rimHex = wheelColors.find((x) => x.id === c.rimColor)?.hex ?? null;
  const custom = c.rims === SKETCHFAB && r.wheels.length > 0;
  const stock = !custom && (c.rims === ORIGINE || r.wheels.length === 0);
  for (const m of meshesOf(r, r.roles.rims)) m.visible = stock;
  if (stock) {
    recolor(r, r.roles.rims, rimHex, (m) => {
      m.metalness = 0.85;
      m.roughness = 0.3;
    });
  }
  if (force || r.built.rims !== c.rims || r.built.rimColor !== c.rimColor) {
    clear(r.rimGroup);
    if (!stock && !custom) {
      const mat = new THREE.MeshStandardMaterial({
        color: rimHex ?? SILVER, metalness: 0.9, roughness: 0.28, side: THREE.DoubleSide,
      });
      for (const w of r.wheels) r.rimGroup.add(buildRim(c.rims, w, mat));
    }
    r.built.rims = c.rims;
    r.built.rimColor = c.rimColor;
  }

  r.partRim.visible = custom;
  for (const m of meshesOf(r, r.roles.tyres)) m.visible = !(custom && r.hideTyres);

  // Échappement
  const customEx = c.exhaust === SKETCHFAB && r.tips.length > 0;
  const stockEx = !customEx && (c.exhaust === ORIGINE || r.tips.length === 0);
  r.partExhaust.visible = customEx;
  for (const m of meshesOf(r, r.roles.exhaust)) m.visible = stockEx;
  if (force || r.built.exhaust !== c.exhaust) {
    clear(r.exhaustGroup);
    if (!stockEx && !customEx) for (const t of r.tips) r.exhaustGroup.add(buildExhaust(c.exhaust, t));
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
