import * as THREE from "three";

/*
 * Mise en scène de la miniature : la voiture (sol à y = 0) posée sur un socle,
 * lui-même posé sur une étagère en bois. Le mur derrière est le fond CSS du lecteur.
 * Le socle et la vitrine suivent les finitions choisies par le client.
 */

export type DisplayOptions = { socle: boolean; vitrine: boolean; label: string };

const PLINTH_H = 0.32;
const SHELF_H = 0.28;

export function buildDisplay(car: THREE.Vector3, opts: DisplayOptions) {
  const group = new THREE.Group();
  const w = car.x * 1.3 + 0.35;
  const d = car.z * 1.1 + 0.35;

  // Étagère : une planche de chêne clair, assez large pour sortir du cadre.
  const shelfMat = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.75, metalness: 0 });
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(d * 9, SHELF_H, w * 1.45), shelfMat);
  shelf.rotation.y = Math.PI / 2;
  shelf.position.y = -PLINTH_H - SHELF_H / 2;
  group.add(shelf);

  // Socle : laqué noir avec plaque gravée en option, sinon bois clair mat.
  const plinthMat = opts.socle
    ? new THREE.MeshPhysicalMaterial({ color: "#121212", roughness: 0.32, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25 })
    : new THREE.MeshStandardMaterial({ color: "#efebe4", roughness: 0.85, metalness: 0 });
  const plinth = new THREE.Mesh(roundedBox(w, PLINTH_H, d, 0.05), plinthMat);
  plinth.position.y = -PLINTH_H / 2;
  group.add(plinth);

  if (opts.socle) {
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(w * 0.42, 2.2), PLINTH_H * 0.5),
      new THREE.MeshStandardMaterial({ map: plateTexture(opts.label), metalness: 0.6, roughness: 0.35 })
    );
    plate.position.set(0, -PLINTH_H / 2, d / 2 + 0.002);
    group.add(plate);
  }

  // Ombre du socle sur l'étagère.
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.35, d * 1.6),
    new THREE.MeshBasicMaterial({ map: softShadow(), transparent: true, depthWrite: false, opacity: 0.55 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -PLINTH_H + 0.002;
  group.add(shadow);

  // Vitrine : un capot en acrylique posé sur le socle.
  if (opts.vitrine) {
    const h = car.y * 1.3 + 0.2;
    const box = new THREE.BoxGeometry(w - 0.12, h, d - 0.12);
    const glass = new THREE.Mesh(
      box,
      new THREE.MeshPhysicalMaterial({
        color: "#ffffff", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.1,
        clearcoat: 1, side: THREE.DoubleSide, depthWrite: false,
      })
    );
    glass.position.y = h / 2;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(box),
      new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55 })
    );
    edges.position.y = h / 2;
    group.add(glass, edges);
  }

  return group;
}

export function disposeDisplay(group: THREE.Group) {
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.geometry) return;
    m.geometry.dispose();
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.map?.dispose();
    mat.dispose();
  });
}

function roundedBox(w: number, h: number, d: number, r: number) {
  const s = new THREE.Shape();
  const x = w / 2, z = d / 2;
  s.moveTo(-x + r, -z);
  s.lineTo(x - r, -z);
  s.quadraticCurveTo(x, -z, x, -z + r);
  s.lineTo(x, z - r);
  s.quadraticCurveTo(x, z, x - r, z);
  s.lineTo(-x + r, z);
  s.quadraticCurveTo(-x, z, -x, z - r);
  s.lineTo(-x, -z + r);
  s.quadraticCurveTo(-x, -z, -x + r, -z);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -h / 2, 0);
  return g;
}

function woodTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c9ab84";
  g.fillRect(0, 0, c.width, c.height);
  // Veines : fines lignes ondulées, plus ou moins sombres.
  for (let i = 0; i < 70; i++) {
    const y = Math.random() * c.height;
    const a = 0.04 + Math.random() * 0.08;
    g.strokeStyle = Math.random() > 0.5 ? `rgba(110,74,40,${a})` : `rgba(255,240,215,${a})`;
    g.lineWidth = 0.6 + Math.random() * 1.8;
    g.beginPath();
    const f = 0.004 + Math.random() * 0.01;
    const amp = 1 + Math.random() * 4;
    for (let x = 0; x <= c.width; x += 16) g.lineTo(x, y + Math.sin(x * f + i) * amp);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  t.anisotropy = 4;
  return t;
}

function plateTexture(label: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, "#d9d4c8");
  grad.addColorStop(1, "#a9a296");
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#2a2724";
  g.font = "600 34px Inter, Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(label.toUpperCase(), c.width / 2, c.height / 2 + 2, c.width - 40);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function softShadow() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  grad.addColorStop(0, "rgba(40,28,15,0.6)");
  grad.addColorStop(0.6, "rgba(40,28,15,0.2)");
  grad.addColorStop(1, "rgba(40,28,15,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
