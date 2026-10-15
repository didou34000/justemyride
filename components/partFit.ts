import * as THREE from "three";

/*
 * Pose automatique d'une pièce téléchargée (jante, sortie d'échappement) sur la voiture.
 * Une pièce Sketchfab arrive dans n'importe quelle orientation et à n'importe quelle échelle :
 * on retrouve son axe et son côté visible à partir de sa forme, on la ramène à une taille de 1,
 * puis on la copie sur chaque roue / chaque sortie de la voiture.
 */

export type PartAdjust = { flip: boolean; turn: number; scale: number };
export const DEFAULT_ADJUST: PartAdjust = { flip: false, turn: 0, scale: 1 };

export type FitWheel = { center: THREE.Vector3; radius: number; tyreRadius: number; width: number; side: number };
export type FitTip = { center: THREE.Vector3; radius: number; rearZ: number };

export type Normalized = {
  /** Pièce centrée, de rayon 1 ; jante : axe X, face visible vers +X ; sortie : axe Z, sortie vers -Z, bord à z = 0. */
  group: THREE.Group;
  /** Jante : la pièce contient aussi le pneu. */
  fullWheel?: boolean;
  /** Épaisseur (jante) ou longueur (sortie), rapportée au rayon. */
  depth: number;
};

const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

function samplePoints(root: THREE.Object3D, max = 60_000) {
  root.updateMatrixWorld(true);
  const out: { p: THREE.Vector3; mat: THREE.Material }[] = [];
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh));
  const total = meshes.reduce((n, m) => n + m.geometry.attributes.position.count, 0);
  const step = Math.max(1, Math.floor(total / max));
  for (const m of meshes) {
    const pos = m.geometry.attributes.position;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material;
    for (let i = 0; i < pos.count; i += step) out.push({ p: new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld), mat });
  }
  return out;
}

const lightness = (m: THREE.Material) => {
  const c = (m as THREE.MeshStandardMaterial).color;
  return c ? c.getHSL({ h: 0, s: 0, l: 0 }).l : 0.5;
};

/** Range la pièce dans un groupe : translation, rotation (dir → cible), mise à l'échelle. */
function wrap(scene: THREE.Object3D, center: THREE.Vector3, dir: THREE.Vector3, target: THREE.Vector3, scale: number) {
  const inner = new THREE.Group();
  inner.add(scene);
  const q = new THREE.Quaternion().setFromUnitVectors(dir.clone().normalize(), target);
  inner.matrixAutoUpdate = false;
  inner.matrix
    .makeScale(scale, scale, scale)
    .multiply(new THREE.Matrix4().makeRotationFromQuaternion(q))
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));
  const group = new THREE.Group();
  group.add(inner);
  return group;
}

export function normalizeRim(scene: THREE.Object3D, adjust: PartAdjust): Normalized | string {
  const pts = samplePoints(scene);
  if (pts.length < 50) return "modèle vide";
  const box = new THREE.Box3();
  pts.forEach(({ p }) => box.expandByPoint(p));
  const size = box.getSize(new THREE.Vector3()).toArray();
  const order = [0, 1, 2].sort((a, b) => size[b] - size[a]);
  // Une jante est un disque : deux dimensions proches, la troisième plus petite.
  if (size[order[1]] / size[order[0]] < 0.75 || size[order[2]] > 0.8 * size[order[0]]) {
    return "ce modèle n'a pas la forme d'une jante (voiture entière ou plusieurs pièces ?)";
  }
  const axisIdx = (order[2] + adjust.turn) % 3;
  const axis = AXES[axisIdx];
  const center = box.getCenter(new THREE.Vector3());
  const R = Math.max(...size.filter((_, i) => i !== axisIdx)) / 2;

  let inner = 0, innerN = 0, dark = 0, darkOuter = 0;
  for (const { p, mat } of pts) {
    const rel = p.clone().sub(center);
    const along = rel.dot(axis);
    const radial = rel.clone().addScaledVector(axis, -along).length();
    // Rayons et moyeu : du côté visible de la jante.
    if (radial < 0.6 * R) {
      inner += along;
      innerN++;
    }
    const dk = lightness(mat) < 0.12 || /tyre|tire|rubber|pneu/i.test(mat.name);
    if (dk) {
      dark++;
      if (radial > 0.75 * R) darkOuter++;
    }
  }
  const fullWheel = dark > 0.15 * pts.length && darkOuter > 0.6 * dark;
  let face = innerN && inner / innerN < 0 ? -1 : 1;
  if (adjust.flip) face = -face;
  return {
    group: wrap(scene, center, axis.clone().multiplyScalar(face), new THREE.Vector3(1, 0, 0), 1 / R),
    fullWheel,
    depth: size[axisIdx] / R,
  };
}

export function placeRims(n: Normalized, wheels: FitWheel[], adjust: PartAdjust, out: THREE.Group) {
  for (const w of wheels) {
    const g = n.group.clone(true);
    const s = (n.fullWheel ? w.tyreRadius : w.radius) * adjust.scale;
    g.scale.setScalar(s);
    const depth = n.depth * s;
    // Face visible alignée sur l'extérieur de la roue, la jante rentre vers l'intérieur.
    const face = w.center.x + w.side * w.width * 0.4;
    g.position.set(face - w.side * depth / 2, w.center.y, w.center.z);
    if (w.side < 0) g.rotation.y = Math.PI;
    out.add(g);
  }
}

export function normalizeTip(scene: THREE.Object3D, adjust: PartAdjust): Normalized | string {
  const pts = samplePoints(scene);
  if (pts.length < 20) return "modèle vide";
  const box = new THREE.Box3();
  pts.forEach(({ p }) => box.expandByPoint(p));
  const size = box.getSize(new THREE.Vector3()).toArray();
  const max = Math.max(...size);
  if (max / Math.min(...size) > 12) return "ce modèle n'a pas la forme d'une sortie d'échappement";
  // L'axe est celui dont la section est la plus ronde (tube vu de face).
  const roundness = [0, 1, 2].map((a) => {
    const o = size.filter((_, i) => i !== a);
    return Math.max(...o) / Math.max(1e-6, Math.min(...o));
  });
  const best = [0, 1, 2].sort((a, b) => roundness[a] - roundness[b] || size[b] - size[a])[0];
  const axisIdx = (best + adjust.turn) % 3;
  const axis = AXES[axisIdx];
  const center = box.getCenter(new THREE.Vector3());
  const half = size[axisIdx] / 2;
  // La sortie est le bout le plus large (embout évasé).
  let endPos = 0, endNeg = 0;
  for (const { p } of pts) {
    const rel = p.clone().sub(center);
    const along = rel.dot(axis);
    const radial = rel.addScaledVector(axis, -along).length();
    if (along > half * 0.7) endPos = Math.max(endPos, radial);
    if (along < -half * 0.7) endNeg = Math.max(endNeg, radial);
  }
  let out = endPos >= endNeg ? 1 : -1;
  if (adjust.flip) out = -out;
  const R = Math.max(...size.filter((_, i) => i !== axisIdx)) / 2;
  const edge = center.clone().addScaledVector(axis, out * half);
  return { group: wrap(scene, edge, axis.clone().multiplyScalar(out), new THREE.Vector3(0, 0, -1), 1 / R), depth: size[axisIdx] / R };
}

export function placeTips(n: Normalized, tips: FitTip[], adjust: PartAdjust, out: THREE.Group) {
  for (const t of tips) {
    const g = n.group.clone(true);
    g.scale.setScalar(t.radius * 1.35 * adjust.scale);
    g.position.set(t.center.x, t.center.y, t.rearZ - 0.03);
    out.add(g);
  }
}

/** Teinte les parties claires d'une pièce (pas le pneu ni les fonds noirs). */
export function tint(root: THREE.Object3D, hex: string | null) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const orig = (m.userData.orig ??= m.material) as THREE.MeshStandardMaterial;
    if (!hex || Array.isArray(orig) || lightness(orig) < 0.12) {
      m.material = orig;
      return;
    }
    const c = orig.clone();
    c.color.set(hex);
    m.material = c;
  });
}
