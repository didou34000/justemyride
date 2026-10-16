import * as THREE from "three";

/*
 * Mise en scène de la miniature : la voiture (sol à y = 0) posée sur un socle rond.
 * Le mur derrière est le fond CSS du lecteur.
 * Le socle et la vitrine suivent les finitions choisies par le client.
 */

export type DisplayOptions = { socle: boolean; vitrine: boolean; label: string };

const PLINTH_H = 0.34;
const EDGE = 0.06;

export function buildDisplay(car: THREE.Vector3, opts: DisplayOptions) {
  const group = new THREE.Group();
  const r = Math.hypot(car.x, car.z) / 2 + 0.25;

  // Socle rond aux arêtes adoucies : laqué noir avec plaque gravée en option, sinon blanc mat.
  const plinthMat = opts.socle
    ? new THREE.MeshPhysicalMaterial({ color: "#121212", roughness: 0.3, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.2 })
    : new THREE.MeshStandardMaterial({ color: "#f1eee8", roughness: 0.8, metalness: 0 });
  const plinth = new THREE.Mesh(roundPlinth(r, PLINTH_H), plinthMat);
  group.add(plinth);

  if (opts.socle) {
    // Plaque cintrée qui suit le bord du socle, face à l'avant de la voiture.
    const arc = Math.min(1.8 / r, 0.9);
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(r + 0.004, r + 0.004, PLINTH_H * 0.42, 48, 1, true, -arc / 2, arc),
      new THREE.MeshStandardMaterial({ map: plateTexture(opts.label), metalness: 0.6, roughness: 0.35 })
    );
    plate.position.y = -PLINTH_H / 2;
    group.add(plate);
  }

  // Ombre douce sous le socle.
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 3, r * 3),
    new THREE.MeshBasicMaterial({ map: softShadow(), transparent: true, depthWrite: false, opacity: 0.5 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -PLINTH_H + 0.002;
  group.add(shadow);

  // Vitrine : une cloche cylindrique en acrylique posée sur le socle.
  if (opts.vitrine) {
    const h = car.y * 1.35 + 0.2;
    const geo = new THREE.CylinderGeometry(r - 0.08, r - 0.08, h, 96, 1, false);
    const glass = new THREE.Mesh(
      geo,
      new THREE.MeshPhysicalMaterial({
        color: "#ffffff", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12,
        clearcoat: 1, side: THREE.DoubleSide, depthWrite: false,
      })
    );
    const rims = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo, 30),
      new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.7 })
    );
    glass.position.y = rims.position.y = h / 2;
    group.add(glass, rims);
  }

  return group;
}

/** Profil tourné autour de Y : fond plat, flanc droit, arête supérieure arrondie, dessus à y = 0. */
function roundPlinth(r: number, h: number) {
  const pts = [new THREE.Vector2(0, -h), new THREE.Vector2(r - 0.02, -h), new THREE.Vector2(r, -h + 0.02), new THREE.Vector2(r, -EDGE)];
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - EDGE + Math.cos(a) * EDGE, -EDGE + Math.sin(a) * EDGE));
  }
  pts.push(new THREE.Vector2(0, 0));
  return new THREE.LatheGeometry(pts, 128);
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
