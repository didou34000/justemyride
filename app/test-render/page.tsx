"use client";
import AdminDemande from "@/components/AdminDemande";
import { STEPS } from "@/lib/steps";
import type { Order } from "@/lib/orders";
const t = "2026-10-20T20:00:00Z";
const o = {
  id: "test123456",
  demande: { id: "test123456", email: "a@b.fr", car: "Mini Cooper S", receivedAt: t, files: [{ slot: "avant-gauche", pathname: "/cars/bmw-m140i.jpg" }] },
  base: { status: "done", startedAt: t, source: "sketchfab", label: "Mini", glb: "/models/bmw-m140i.glb" },
  rapport1: null, couleurs: null,
  rapport2: { status: "done", startedAt: t, model: "x", result: { resume: "", ressemblance: "proche", deja_bon: [], blender: [{ probleme: "Toit", ou: "toit", correction: "x", importance: "haute" }], formes_3d: [], alertes: [] } },
  rapport3: { status: "done", startedAt: t, model: "x", crops: ["/cars/bmw-m140i.jpg", null], result: { resume: "Proche, il manque les jantes et le badge S.", manques: [{ element: "Jantes 5 branches doubles", ou: "4 roues", importance: "essentiel", solution: "meshy" }, { element: "Badge S calandre", ou: "calandre", importance: "essentiel", solution: "decalque" }, { element: "Sticker arrière", ou: "hayon", importance: "secondaire", solution: "ignorer" }], meshy: [{ piece: "Jante avant gauche", photo: "avant-gauche", cadre: { x: 0.1, y: 0.5, l: 0.2, h: 0.3 }, consigne: "Jante 5 branches doubles, 17 pouces." }, { piece: "Aileron de toit", photo: "arriere", cadre: { x: 0, y: 0, l: 1, h: 0.3 }, consigne: "Aileron JCW." }] } },
  pieces: { jobs: [] },
  couleursGlb: "/models/bmw-m140i.glb",
  fichiers: { v2: "/models/bmw-m140i.glb" }, suivi: {},
} as unknown as Order;
const steps = STEPS.map((s, i) => ({ key: s.key, label: s.label, who: s.who, state: i < 7 ? "done" : i === 7 ? "current" : "todo" })) as Order["steps"];
export default function P() { return <main><AdminDemande order={{ ...o, steps, progress: 0.5 }} /></main>; }
