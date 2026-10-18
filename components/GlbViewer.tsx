"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** Visionneuse simple d'un GLB (rendu Meshy) : on tourne autour à la souris ou au doigt. */
export default function GlbViewer({ src }: { src: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(35, el.clientWidth / el.clientHeight, 0.01, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;

    let frame = 0;
    let disposed = false;
    new GLTFLoader().load(
      src,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        // Sans texture, Meshy livre un modèle tout blanc : une teinte grise fait ressortir les volumes.
        model.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && !(m.material as THREE.MeshStandardMaterial).map)
            m.material = new THREE.MeshStandardMaterial({ color: 0xb9b4ab, roughness: 0.55, metalness: 0.1 });
        });
        const b = new THREE.Box3().setFromObject(model);
        const size = b.getSize(new THREE.Vector3()).length();
        model.position.sub(b.getCenter(new THREE.Vector3()));
        scene.add(model);
        camera.position.set(size * 0.75, size * 0.35, size * 0.75);
        camera.near = size / 100;
        camera.far = size * 10;
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        setState("ok");
      },
      undefined,
      () => !disposed && setState("error")
    );

    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    loop();
    const onResize = () => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      pmrem.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [src]);

  return (
    <div ref={box} className="glb-viewer">
      {state === "loading" && <span>Chargement du modèle…</span>}
      {state === "error" && <span>Modèle illisible ou introuvable.</span>}
    </div>
  );
}
