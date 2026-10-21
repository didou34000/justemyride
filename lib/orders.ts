import { del, list } from "@vercel/blob";
import { readJson, writeJson } from "@/lib/blobJson";
import { claudeConfigured, stale, type Rec } from "@/lib/claude";
import { readBase, type BaseRecord } from "@/lib/base";
import { readEssais, type ControleEssai, type ControleRec, type CouleursRec, type Rapport1, type Rapport2, type Rapport3Rec } from "@/lib/rapports";
import { readPieces, type Pieces } from "@/lib/meshy";
import { jobFailed, piecesRunning, retained3d } from "@/lib/meshyShared";
import { readFichiers, type Fichiers } from "@/lib/fichiers";
import type { Base } from "@/lib/catalog";
import { CONTROLE, STEPS, type ManualStep, type Step, type Suivi } from "@/lib/steps";

export { MANUAL, STEPS, type ManualStep, type Step, type Suivi } from "@/lib/steps";

/**
 * Suivi des demandes pour le tableau de bord admin.
 * Chaque demande vit dans submissions/<id>/ : demande.json (envoi du client), base.json + base.glb (le modèle Sketchfab),
 * rapport1.json, couleurs.json + couleurs.glb, rapport2.json, rapport3.json + piece-N.jpg (les passages de Claude),
 * meshy-pieces.json + meshy-piece-N.glb (les pièces Meshy), fichiers.json (fichiers déposés : v2, final…)
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
  rapport3: Rapport3Rec | null;
  pieces: Pieces;
  /** Contrôle final de la miniature terminée, et tous ses essais (score par essai). */
  controle: ControleRec | null;
  essais: ControleEssai[];
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
  const { demande: d, base: b, rapport1: r1, couleurs: c, rapport2: r2, rapport3: r3, pieces: p, fichiers: f, suivi: s, controle: k, essais } = o;
  const steps: Step[] = STEPS.map((def) => {
    const base = { key: def.key, label: def.label, who: def.who };
    const noKey = !claudeOn && ["rapport1", "couleurs", "rapport2", "rapport3", "controle"].includes(def.key);
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
      case "v2":
        return f.v2 ? { ...base, state: "done", note: "V2 déposée" } : { ...base, state: "todo" };
      case "rapport3":
        if (noKey && !r3) return { ...base, state: "error", note: "Clé Claude absente de Vercel." };
        return claudeStep(base, r3, (r) => `${(r as Rapport3Rec).result?.meshy.length ?? 0} pièce(s) pour Meshy`);
      case "meshy": {
        const want = r3?.result?.meshy.length ?? 0;
        if (r3?.status === "done" && !want) return { ...base, state: "skip", note: "rien d'essentiel à générer" };
        if (!p.jobs.length) return { ...base, state: "todo" };
        const ok = retained3d(p).length;
        if (piecesRunning(p)) return { ...base, state: "current", busy: true, note: `${ok}/${want} pièce(s) en 3D` };
        if (ok >= want) return { ...base, state: "done", note: `${ok} pièce(s) en 3D` };
        const last = p.jobs.at(-1)!;
        if (jobFailed(last)) return { ...base, state: "error", note: last.error ?? "Échec Meshy" };
        return { ...base, state: "current", note: `${ok}/${want} pièce(s) en 3D` };
      }
      case "retouches":
        return f.final ? { ...base, state: "done", note: "miniature déposée" } : { ...base, state: "todo" };
      case "controle": {
        if (!f.final) return { ...base, state: "todo" };
        if (noKey && !k) return { ...base, state: "error", note: "Clé Claude absente de Vercel." };
        const last = essais.at(-1);
        if (k?.status === "running" || k?.status === "error" || !last) return claudeStep(base, k, () => "");
        if (last.glb !== f.final) {
          if (essais.length >= CONTROLE.maxEssais) return { ...base, state: "error", note: `${CONTROLE.maxEssais} essais faits : à toi de décider` };
          return { ...base, state: "todo", note: "nouvelle miniature à contrôler" };
        }
        if (last.valide) return { ...base, state: "done", date: last.at, note: `${last.score} % : validée` };
        const fin = essais.length >= CONTROLE.maxEssais ? ` : ${CONTROLE.maxEssais} essais, à toi de décider` : ` : à corriger (essai ${essais.length}/${CONTROLE.maxEssais})`;
        return { ...base, state: "error", date: last.at, note: `${last.score} %${fin}` };
      }
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
  const [base, rapport1, couleurs, rapport2, rapport3, pieces, fichiers, suivi, controle, essais] = await Promise.all([
    readBase(id),
    readJson<Rec<Rapport1>>(`submissions/${id}/rapport1.json`),
    readJson<CouleursRec>(`submissions/${id}/couleurs.json`),
    readJson<Rec<Rapport2>>(`submissions/${id}/rapport2.json`),
    readJson<Rapport3Rec>(`submissions/${id}/rapport3.json`),
    readPieces(id),
    readFichiers(id),
    readJson<Suivi>(suiviPath(id)).then((s) => s ?? {}),
    readJson<ControleRec>(`submissions/${id}/controle.json`),
    readEssais(id),
  ]);
  const o = { demande: { ...demande, id }, base, rapport1, couleurs, rapport2, rapport3, pieces, controle, essais, couleursGlb: fichiers.couleurs ?? couleurs?.glb, fichiers, suivi };
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
