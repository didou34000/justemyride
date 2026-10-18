import { list } from "@vercel/blob";
import { readJson, writeJson } from "@/lib/blobJson";
import type { AnalysisRecord } from "@/lib/analyse";
import type { Job } from "@/lib/meshy";
import type { Base } from "@/lib/catalog";
import { STEPS, type ManualStep, type Step, type Suivi } from "@/lib/steps";

export { MANUAL, STEPS, type ManualStep, type Step, type Suivi } from "@/lib/steps";

/**
 * Suivi des demandes pour le tableau de bord admin.
 * Chaque demande vit dans submissions/<id>/ : demande.json (envoi du client), analyse.json (le point),
 * meshy.json (génération 3D) et suivi.json (les étapes cochées à la main par le propriétaire).
 */

export type Demande = {
  id: string;
  email: string;
  car: string;
  base?: Base | null;
  receivedAt?: string;
  files: { slot: string; pathname: string }[];
};

export type Order = {
  id: string;
  demande: Demande;
  analyse: AnalysisRecord | null;
  meshy: Job | null;
  suivi: Suivi;
  steps: Step[];
  progress: number;
};

const suiviPath = (id: string) => `submissions/${id}/suivi.json`;

export function buildSteps(d: Demande, a: AnalysisRecord | null, m: Job | null, s: Suivi): Step[] {
  const needsParts = a?.result?.differences.some((x) => x.traitement === "piece_3d");
  const steps: Step[] = STEPS.map((def) => {
    const base = { key: def.key, label: def.label, who: def.who };
    if (def.key === "photos") return { ...base, state: "done" as const, date: d.receivedAt, note: `${d.files.length} photos` };
    if (def.key === "analyse") {
      if (!a) return { ...base, state: "todo" as const };
      if (a.status === "error") return { ...base, state: "error" as const, date: a.startedAt, note: a.error };
      if (a.status === "running") return { ...base, state: "current" as const, date: a.startedAt, note: "en cours" };
      return { ...base, state: "done" as const, date: a.startedAt, note: `${a.result?.differences.length ?? 0} différence(s)` };
    }
    if (def.key === "pieces") {
      if (m?.glb || m?.status === "SUCCEEDED") return { ...base, state: "done" as const, date: m.startedAt, note: "modèle reçu" };
      if (m && ["FAILED", "CANCELED", "error"].includes(m.status)) return { ...base, state: "error" as const, date: m.startedAt, note: m.error };
      if (m) return { ...base, state: "current" as const, date: m.startedAt, note: m.progress ? `${m.progress} %` : "en cours" };
      if (a?.status === "done" && !needsParts) return { ...base, state: "skip" as const, note: "aucune pièce à faire" };
      return { ...base, state: "todo" as const };
    }
    const date = def.manual ? s[def.manual] : undefined;
    return { ...base, state: date ? ("done" as const) : ("todo" as const), date };
  });
  // La première étape non faite devient l'étape en cours.
  const next = steps.find((x) => x.state === "todo");
  if (next && !steps.some((x) => x.state === "current" || x.state === "error")) next.state = "current";
  return steps;
}

export async function getOrder(id: string): Promise<Order | null> {
  const demande = await readJson<Demande>(`submissions/${id}/demande.json`);
  if (!demande) return null;
  const [analyse, meshy, suivi] = await Promise.all([
    readJson<AnalysisRecord>(`submissions/${id}/analyse.json`),
    readJson<Job>(`submissions/${id}/meshy.json`),
    readJson<Suivi>(suiviPath(id)).then((s) => s ?? {}),
  ]);
  const steps = buildSteps(demande, analyse, meshy, suivi);
  const progress = steps.filter((s) => s.state === "done" || s.state === "skip").length / steps.length;
  return { id, demande: { ...demande, id }, analyse, meshy, suivi, steps, progress };
}

/** Toutes les demandes, la plus récente d'abord. */
export async function listOrders(): Promise<Order[]> {
  const ids = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "submissions/", cursor, limit: 1000 });
    for (const b of page.blobs) {
      const m = b.pathname.match(/^submissions\/([\w-]+)\/demande\.json$/);
      if (m) ids.add(m[1]);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const orders = (await Promise.all([...ids].map(getOrder))).filter((o): o is Order => Boolean(o));
  return orders.sort((a, b) => (b.demande.receivedAt ?? b.id).localeCompare(a.demande.receivedAt ?? a.id));
}

export async function setManualStep(id: string, step: ManualStep, done: boolean) {
  const suivi = (await readJson<Suivi>(suiviPath(id))) ?? {};
  if (done) suivi[step] = new Date().toISOString();
  else delete suivi[step];
  await writeJson(suiviPath(id), suivi);
  return suivi;
}
