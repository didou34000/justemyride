import { del, list } from "@vercel/blob";
import { readJson, writeJson } from "@/lib/blobJson";
import { claudeConfigured, stale, type Rec } from "@/lib/claude";
import { readBase, type BaseRecord } from "@/lib/base";
import type { CouleursRec, Rapport1, Rapport2 } from "@/lib/rapports";
import { readFichiers, type Fichiers } from "@/lib/fichiers";
import type { Base } from "@/lib/catalog";
import { STEPS, type ManualStep, type Step, type Suivi } from "@/lib/steps";

export { MANUAL, STEPS, type ManualStep, type Step, type Suivi } from "@/lib/steps";

/**
 * Suivi des demandes pour le tableau de bord admin.
 * Chaque demande vit dans submissions/<id>/ : demande.json (envoi du client), base.json + base.glb (le modèle Sketchfab),
 * rapport1.json, couleurs.json + couleurs.glb, rapport2.json (les passages de Claude), fichiers.json (fichiers déposés)
 * et suivi.json (les étapes cochées à la main par le propriétaire).
 */

export type Demande = {
  id: string;
  email: string;
  car: string;
  base?: Base | null;
  size?: string;
  receivedAt?: string;
  files: { slot: string; pathname: string }[];
};

export type Order = {
  id: string;
  demande: Demande;
  base: BaseRecord | null;
  rapport1: Rec<Rapport1> | null;
  couleurs: CouleursRec | null;
  rapport2: Rec<Rapport2> | null;
  /** La voiture repeinte qui compte : celle refaite dans Blender si elle a été déposée, sinon celle du site. */
  couleursGlb?: string;
  fichiers: Fichiers;
  suivi: Suivi;
  steps: Step[];
  progress: number;
};

const suiviPath = (id: string) => `submissions/${id}/suivi.json`;

/** État d'un passage de Claude dans le schéma. */
function claudeStep(base: Omit<Step, "state">, r: Rec<unknown> | null, done: (r: Rec<unknown>) => string): Step {
  if (!r) return { ...base, state: "todo" };
  if (r.status === "error") return { ...base, state: "error", date: r.startedAt, note: r.error };
  if (stale(r)) return { ...base, state: "error", date: r.startedAt, note: "Interrompu : relance-le." };
  if (r.status === "running") return { ...base, state: "current", date: r.startedAt, note: "en cours", busy: true };
  return { ...base, state: "done", date: r.startedAt, note: done(r) };
}

export function buildSteps(o: Omit<Order, "steps" | "progress" | "id">, claudeOn = true): Step[] {
  const { demande: d, base: b, rapport1: r1, couleurs: c, rapport2: r2, fichiers: f, suivi: s } = o;
  const steps: Step[] = STEPS.map((def) => {
    const base = { key: def.key, label: def.label, who: def.who };
    const noKey = !claudeOn && ["rapport1", "couleurs", "rapport2"].includes(def.key);
    switch (def.key) {
      case "base":
        if (!b) return { ...base, state: "todo" };
        if (b.status === "error") return { ...base, state: "error", date: b.startedAt, note: b.error };
        if (b.status === "running" && !stale(b)) return { ...base, state: "current", date: b.startedAt, note: "téléchargement", busy: true };
        if (b.status === "running") return { ...base, state: "error", date: b.startedAt, note: "Téléchargement interrompu : relance-le." };
        return { ...base, state: "done", date: b.startedAt, note: b.label };
      case "photos":
        return { ...base, state: "done", date: d.receivedAt, note: `${d.files.length} photos` };
      case "rapport1":
        if (noKey && !r1) return { ...base, state: "error", note: "Clé Claude (ANTHROPIC_API_KEY) absente de Vercel." };
        return claudeStep(base, r1, (r) => `${(r as Rec<Rapport1>).result?.differences.length ?? 0} différence(s)`);
      case "couleurs":
        if (f.couleurs) return { ...base, state: "done", note: "refaites dans Blender" };
        if (noKey && !c) return { ...base, state: "error", note: "Clé Claude absente de Vercel." };
        return claudeStep(base, c, (r) => `${(r as CouleursRec).applied?.length ?? 0} matériau(x) repeint(s)`);
      case "rapport2":
        if (noKey && !r2) return { ...base, state: "error", note: "Clé Claude absente de Vercel." };
        return claudeStep(base, r2, (r) => `${(r as Rec<Rapport2>).result?.formes_3d.length ?? 0} forme(s) 3D`);
      case "retouches":
        return f.final ? { ...base, state: "done", note: "miniature déposée" } : { ...base, state: "todo" };
    }
    const date = def.manual ? s[def.manual] : undefined;
    return { ...base, state: date ? "done" : "todo", date };
  });
  // La première étape non faite devient l'étape en cours.
  const next = steps.find((x) => x.state === "todo");
  if (next && !steps.some((x) => x.state === "current" || x.state === "error")) next.state = "current";
  return steps;
}

export async function getOrder(id: string): Promise<Order | null> {
  const demande = await readJson<Demande>(`submissions/${id}/demande.json`);
  if (!demande) return null;
  const [base, rapport1, couleurs, rapport2, fichiers, suivi] = await Promise.all([
    readBase(id),
    readJson<Rec<Rapport1>>(`submissions/${id}/rapport1.json`),
    readJson<CouleursRec>(`submissions/${id}/couleurs.json`),
    readJson<Rec<Rapport2>>(`submissions/${id}/rapport2.json`),
    readFichiers(id),
    readJson<Suivi>(suiviPath(id)).then((s) => s ?? {}),
  ]);
  const o = { demande: { ...demande, id }, base, rapport1, couleurs, rapport2, couleursGlb: fichiers.couleurs ?? couleurs?.glb, fichiers, suivi };
  const steps = buildSteps(o, claudeConfigured());
  const progress = steps.filter((s) => s.state === "done" || s.state === "skip").length / steps.length;
  return { id, ...o, steps, progress };
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

/**
 * Efface une demande (ou toutes) : tous les fichiers de submissions/<id>/ (photos, modèles, rapports).
 * Les compteurs de plafonds (analyse/, meshy/) ne sont pas dans submissions/ : ils restent.
 */
export async function deleteOrders(id?: string) {
  const prefix = id ? `submissions/${id}/` : "submissions/";
  let cursor: string | undefined;
  let count = 0;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    if (page.blobs.length) await del(page.blobs.map((b) => b.url));
    count += page.blobs.length;
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return count;
}
