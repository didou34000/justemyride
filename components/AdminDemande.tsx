"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { sendFile } from "@/lib/uploadClient";
import { useRouter } from "next/navigation";
import { Flow, StepIcon } from "./Flow";
import { photoSrc } from "@/lib/photo";
import LiveRefresh from "./LiveRefresh";
import GlbViewer from "./GlbViewer";
import MeshyPieces from "./MeshyPieces";
import { retained3d } from "@/lib/meshyShared";
import { renderHighlights, renderViews } from "./renderViews";
import { CONTROLE, STEPS } from "@/lib/steps";
import type { Order } from "@/lib/orders";
import PlatePreview from "./PlatePreview";
import { plaqueArgs, plaqueResume } from "@/lib/plaques";

const TRAITEMENT: Record<string, string> = {
  couleur: "Peinture",
  decalque: "Décalque",
  blender: "Blender",
  forme_3d: "Forme 3D",
  a_verifier: "À vérifier",
};

const SOURCE: Record<string, string> = {
  sketchfab: "Pièce Sketchfab",
  a_modeliser: "À modéliser",
  decalque_relief: "Décalque en relief",
};

const GRAVITE: Record<string, string> = { bloquant: "Bloquant", a_corriger: "À corriger", detail: "Détail (on peut laisser)" };
const CORRECTION: Record<string, string> = { blender: "Blender", couleur: "Couleur", meshy: "Meshy", decalque: "Décalque" };

const SOLUTION3: Record<string, string> = {
  meshy: "Meshy",
  blender: "Blender",
  decalque: "Décalque",
  ignorer: "On laisse",
};

const RESSEMBLANCE: Record<string, string> = {
  tres_proche: "Très proche de la vraie voiture",
  proche: "Proche de la vraie voiture",
  moyenne: "Ressemblance moyenne",
  loin: "Encore loin de la vraie voiture",
};

const day = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";

type Kind = "base" | "couleurs" | "v2" | "final";

/**
 * Page du propriétaire pour une demande : le circuit en blocs, et le détail du bloc choisi.
 * Les passages de Claude s'enchaînent toutes seules tant que cette page est ouverte : c'est ce navigateur
 * qui rend les vues 3D que Claude regarde (le serveur ne sait pas faire de 3D).
 */
export default function AdminDemande({ order }: { order: Order }) {
  const router = useRouter();
  const { id, demande, base, rapport1, couleurs, rapport2, rapport3, pieces, controle, essais, couleursGlb, fichiers, suivi, steps } = order;
  const first = steps.find((s) => s.state === "error" || s.state === "current")?.key ?? "base";
  const [sel, setSel] = useState(first);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [uid, setUid] = useState("");
  const step = steps.find((s) => s.key === sel)!;
  const def = STEPS.find((s) => s.key === sel)!;
  const state = (k: string) => steps.find((s) => s.key === k);
  const running = steps.some((s) => s.busy) || Boolean(busy);
  const baseGlb = base?.status === "done" ? base.glb : undefined;
  const r1 = rapport1?.result;
  const c = couleurs?.result;
  const r2 = rapport2?.result;
  const r3 = rapport3?.result;
  const v2Glb = fichiers.v2 ?? couleursGlb;
  const meshyBusy = Boolean(state("meshy")?.busy);

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? `Erreur ${res.status}`);
    return d;
  }

  /** Lance une étape : label pour le bouton, work fait le rendu puis l'appel. */
  async function run(label: string, work: () => Promise<unknown>) {
    setBusy(label);
    setError("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy("");
    router.refresh();
  }

  const fetchBase = (other?: string) => run("base", () => post("/api/base", { id, uid: other }));
  const doRapport1 = () =>
    run("rapport1", async () => {
      if (!baseGlb) throw new Error("Pas encore de modèle de base");
      const views = await renderViews(photoSrc(baseGlb)).catch((e) => Promise.reject(new Error(`Rendu des vues impossible : ${e.message}`)));
      return post("/api/rapport", { id, step: "rapport1", views });
    });
  const doCouleurs = () =>
    run("couleurs", async () => {
      if (!baseGlb) throw new Error("Pas encore de modèle de base");
      const sheets = await renderHighlights(photoSrc(baseGlb)).catch((e) => Promise.reject(new Error(`Rendu des matériaux impossible : ${e.message}`)));
      return post("/api/rapport", { id, step: "couleurs", sheets });
    });
  const doRapport2 = () =>
    run("rapport2", async () => {
      if (!couleursGlb) throw new Error("Pas encore de voiture repeinte");
      const views = await renderViews(photoSrc(couleursGlb)).catch((e) => Promise.reject(new Error(`Rendu des vues impossible : ${e.message}`)));
      return post("/api/rapport", { id, step: "rapport2", views });
    });

  const doRapport3 = () =>
    run("rapport3", async () => {
      if (!v2Glb) throw new Error("Pas encore de V2");
      const views = await renderViews(photoSrc(v2Glb)).catch((e) => Promise.reject(new Error(`Rendu des vues impossible : ${e.message}`)));
      return post("/api/rapport", { id, step: "rapport3", views });
    });

  // Contrôle final : vues de la miniature terminée, notées par Claude (force : au-delà du nombre d'essais prévu).
  const doControle = (force = false) =>
    run("controle", async () => {
      if (!fichiers.final) throw new Error("Pas encore de miniature terminée");
      const views = await renderViews(photoSrc(fichiers.final)).catch((e) => Promise.reject(new Error(`Rendu des vues impossible : ${e.message}`)));
      return post("/api/rapport", { id, step: "controle", views, force });
    });
  const lastEssai = essais.at(-1);
  const controleValide = Boolean(lastEssai?.valide && lastEssai.glb === fichiers.final);
  const essaisFinis = essais.length >= CONTROLE.maxEssais;

  // L'enchaînement automatique : chaque étape part une fois, seulement si elle n'a jamais été lancée.
  // Après une erreur, rien ne repart tout seul : on relance au bouton.
  const started = useRef(new Set<string>());
  useEffect(() => {
    if (busy || steps.some((s) => s.busy)) return;
    const once = (k: string, go: () => void) => {
      if (started.current.has(k)) return;
      started.current.add(k);
      go();
    };
    if (!base) return once("base", () => fetchBase());
    if (!baseGlb) return;
    if (!rapport1) return once("rapport1", doRapport1);
    if (rapport1.status !== "done") return;
    if (!couleurs && !fichiers.couleurs) return once("couleurs", doCouleurs);
    if (couleursGlb && !rapport2 && (fichiers.couleurs || couleurs?.status === "done")) return once("rapport2", doRapport2);
    // Le 3e rapport part tout seul seulement quand la V2 de Blender est déposée.
    if (fichiers.v2 && !rapport3) return once("rapport3", doRapport3);
    // Chaque nouvelle miniature déposée est contrôlée une fois, jusqu'à maxEssais (la boucle s'arrête là).
    const fresh = fichiers.final && !essais.some((e) => e.glb === fichiers.final);
    if (fresh && !essaisFinis && (!controle || controle.status === "done")) once(`controle:${fichiers.final}`, () => doControle());
  });

  // Dépôt d'un fichier par le propriétaire : envoi direct vers le stockage, puis enregistrement dans la demande.
  async function pick(e: ChangeEvent<HTMLInputElement>, kind: Kind) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await run(kind === "base" ? "base" : kind, async () => {
      const { mode } = await fetch("/api/storage").then((r) => r.json());
      if (!mode) throw new Error("Stockage non configuré");
      const blob = await sendFile(`submissions/${id}/${kind}.glb`, file, {
        mode,
        handleUploadUrl: "/api/admin/upload",
        contentType: "model/gltf-binary",
      });
      return post("/api/admin/fichier", { id, kind, pathname: blob.pathname });
    });
  }

  const call = (label: string, url: string, body: unknown) => run(label, () => post(url, body));

  async function remove() {
    if (!window.confirm("Effacer cette demande pour de bon (photos, modèles, rapports) ?")) return;
    setBusy("delete");
    await post("/api/admin/supprimer", { id }).catch((e) => setError(e.message));
    router.push("/admin");
    router.refresh();
  }

  const glbDrop = (kind: Kind, label: string, primary = false) => (
    <label className={`cta ${primary ? "" : "ghost"} ${busy ? "off" : ""}`}>
      {busy === kind ? "Envoi…" : label}
      <input type="file" accept=".glb,model/gltf-binary" hidden disabled={Boolean(busy)} onChange={(e) => pick(e, kind)} />
    </label>
  );

  const redo = (k: string, label: string, go: () => void) => (
    <button className="cta ghost" disabled={Boolean(busy) || Boolean(state(k)?.busy)} onClick={go}>
      {busy === k ? "En cours…" : label}
    </button>
  );

  return (
    <section className="admin wide">
      <div className="admin-top">
        <div>
          <p className="eyebrow">Demande du {day(demande.receivedAt)}</p>
          <h2>{demande.car || demande.base?.label || "Voiture"}</h2>
          <p className="sub">
            <a className="link" href={`mailto:${demande.email}`}>{demande.email}</a>
            {demande.size && ` · taille ${demande.size.replace("-", ":")}`}
            {demande.apercuPaye && " · aperçu payé 5 €, à déduire de la miniature"}
          </p>
          {demande.plaque && (
            <p className="sub admin-plaque">
              <PlatePreview plaque={demande.plaque} className="plate-svg small" />
              <span>
                Plaque : {plaqueResume(demande.plaque)}
                {demande.plaque.style !== "aucune" && (
                  <>
                    {" "}(à poser dans Blender : <code>tools/plaque.py {plaqueArgs(demande.plaque)}</code>)
                  </>
                )}
              </span>
            </p>
          )}
        </div>
        <span className="admin-top-r">
          <LiveRefresh every={running ? 8 : 30} poll={meshyBusy ? `/api/meshy?id=${id}` : undefined} />
          <button className="link" disabled={Boolean(busy)} onClick={remove}>
            Effacer la demande
          </button>
        </span>
      </div>

      <Flow
        steps={steps}
        order={order}
        selected={sel}
        onSelect={(k) => {
          setSel(k);
          // Sur téléphone, le détail est sous le circuit : on y descend.
          if (window.matchMedia("(max-width: 640px)").matches)
            setTimeout(() => document.getElementById("node-panel")?.scrollIntoView({ behavior: "smooth" }), 50);
        }}
      />

      <div id="node-panel" className={`node-panel t-${def.tone}`}>
        <div className="node-panel-head">
          <span className="node-icon">
            <StepIcon k={sel} />
          </span>
          <div>
            <strong>{def.label}</strong>
            <span className="sub">
              {def.who} · {def.help}
            </span>
          </div>
        </div>

        {sel === "base" && (
          <>
            {step.state === "error" && <p className="notice err">{step.note}</p>}
            {step.busy && <p className="notice">Le site télécharge le modèle depuis Sketchfab…</p>}
            {baseGlb && (
              <>
                <GlbViewer src={photoSrc(baseGlb)} colors />
                <p className="sub">
                  {base?.label}
                  {base?.author && ` · par ${base.author}`}
                  {base?.licence && ` · licence ${base.licence}`}
                  {base?.sizeMb && ` · ${base.sizeMb} Mo${base.sizeMbOriginal ? ` (${base.sizeMbOriginal} Mo avant allègement)` : ""}`}
                  {base?.uid && (
                    <>
                      {" · "}
                      <a className="link" href={`https://sketchfab.com/3d-models/${base.uid}`} target="_blank" rel="noreferrer">voir sur Sketchfab</a>
                    </>
                  )}
                  {" · "}
                  <a className="link" href={photoSrc(baseGlb)} download={`base-${id}.glb`}>Télécharger le .glb</a>
                </p>
                {base?.source === "garage" && <p className="sub">Voiture déjà préparée du garage du site.</p>}
              </>
            )}
            <h4>Changer de modèle de base</h4>
            <p className="sub">Si le client s&apos;est trompé de génération, colle l&apos;adresse d&apos;un autre modèle Sketchfab. Refais ensuite les rapports.</p>
            <div className="admin-actions">
              <input style={{ flex: "1 1 280px" }} placeholder="https://sketchfab.com/3d-models/…" value={uid} onChange={(e) => setUid(e.target.value)} />
              <button className="cta" disabled={Boolean(busy) || !uid.trim()} onClick={() => fetchBase(uid.trim())}>
                {busy === "base" ? "Téléchargement…" : "Télécharger ce modèle"}
              </button>
              {!uid && base?.status === "error" && demande.base?.uid && (
                <button className="cta ghost" disabled={Boolean(busy)} onClick={() => fetchBase()}>
                  Réessayer
                </button>
              )}
              {glbDrop("base", "Ou déposer un .glb")}
            </div>
          </>
        )}

        {sel === "photos" && (
          <div className="admin-photos">
            {demande.files.map((f) => (
              <a key={f.pathname} href={photoSrc(f.pathname)} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoSrc(f.pathname)} alt={f.slot} loading="lazy" />
                <span>{f.slot}</span>
              </a>
            ))}
          </div>
        )}

        {sel === "rapport1" && (
          <>
            {!rapport1 && !baseGlb && <p className="notice">Il faut d&apos;abord le modèle de base.</p>}
            {(step.busy || busy === "rapport1") && <p className="notice">Claude compare les photos au modèle, le rapport s&apos;affiche ici tout seul.</p>}
            {step.state === "error" && <p className="notice err">Rapport impossible : {step.note}</p>}
            {r1 && (
              <>
                <p className="admin-resume">{r1.resume}</p>
                <p className={`notice ${r1.base_ok ? "" : "err"}`}>
                  <b>Modèle de base {r1.base_ok ? "OK" : "à revoir"} :</b> {r1.base_remarque}
                </p>
                <h4>Couleurs de la vraie voiture</h4>
                <div className="zone-chips">
                  {r1.couleurs.map((z, i) => (
                    <span key={i} className="zone-chip">
                      <i style={{ background: z.hex }} />
                      <b>{z.zone}</b> {z.couleur} · {z.finition}
                    </span>
                  ))}
                </div>
                <h4>Différences avec le modèle</h4>
                <div className="admin-diffs">
                  {r1.differences.map((d, i) => (
                    <div key={i} className={`admin-diff conf-${d.confiance}`}>
                      <div className="admin-diff-head">
                        <strong>{d.ou}</strong>
                        <span className="chip on">{TRAITEMENT[d.traitement] ?? d.traitement}</span>
                      </div>
                      <p>{d.description}</p>
                      <span className="sub">
                        {d.categorie.replace(/_/g, " ")} · confiance {d.confiance} · photos : {d.photos.join(", ") || "?"}
                      </span>
                    </div>
                  ))}
                  {!r1.differences.length && <p className="notice">Aucune différence : le modèle de base suffit.</p>}
                </div>
                {r1.photos_a_demander.length > 0 && (
                  <>
                    <h4>Photos à demander au client</h4>
                    <ul className="admin-list">{r1.photos_a_demander.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  </>
                )}
                {r1.alertes.length > 0 && (
                  <>
                    <h4>Alertes</h4>
                    <ul className="admin-list">{r1.alertes.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  </>
                )}
              </>
            )}
            {baseGlb && <div className="admin-actions">{redo("rapport1", rapport1 ? "Refaire le 1er rapport" : "Lancer le 1er rapport", doRapport1)}</div>}
          </>
        )}

        {sel === "couleurs" && (
          <>
            {(step.busy || busy === "couleurs") && (
              <p className="notice">Claude repère chaque matériau du modèle et choisit sa couleur. Le site repeint ensuite le fichier.</p>
            )}
            {step.state === "error" && <p className="notice err">Couleurs impossibles : {step.note}</p>}
            {baseGlb && (
              <div className="meshy-io">
                <div className="meshy-col">
                  <h4>Modèle de base</h4>
                  <GlbViewer src={photoSrc(baseGlb)} colors />
                </div>
                <span className="meshy-arrow" aria-hidden>→</span>
                <div className="meshy-col">
                  <h4>{fichiers.couleurs ? "Repeint dans Blender" : "Repeint par Claude"}</h4>
                  {couleursGlb ? (
                    <>
                      <GlbViewer src={photoSrc(couleursGlb)} colors />
                      <p className="sub">
                        <a className="link" href={photoSrc(couleursGlb)} download={`couleurs-${id}.glb`}>Télécharger le .glb</a>
                      </p>
                    </>
                  ) : (
                    <div className="glb-viewer">
                      <span>Pas encore repeint.</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {c && (
              <>
                <p className="admin-resume">{c.resume}</p>
                <h4>Matériaux repeints</h4>
                <div className="zone-chips">
                  {c.materiaux
                    .filter((m) => m.action === "peindre")
                    .map((m) => (
                      <span key={m.id} className="zone-chip">
                        <i style={{ background: m.couleur }} />
                        <b>{m.zone}</b> {m.finition} <code>{m.id}</code>
                      </span>
                    ))}
                </div>
                {c.limites.length > 0 && (
                  <>
                    <h4>Impossible juste en changeant les matériaux (à faire dans Blender)</h4>
                    <ul className="admin-list">{c.limites.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  </>
                )}
              </>
            )}
            <div className="admin-actions">
              {baseGlb && rapport1?.status === "done" && redo("couleurs", couleurs ? "Refaire les couleurs" : "Lancer les couleurs", doCouleurs)}
              {glbDrop("couleurs", fichiers.couleurs ? "Remplacer la version Blender" : "Déposer une version refaite dans Blender")}
            </div>
          </>
        )}

        {sel === "rapport2" && (
          <>
            {!couleursGlb && <p className="notice">Il faut d&apos;abord la voiture repeinte.</p>}
            {(step.busy || busy === "rapport2") && <p className="notice">Claude compare la voiture repeinte aux photos, le rapport s&apos;affiche ici tout seul.</p>}
            {step.state === "error" && <p className="notice err">Rapport impossible : {step.note}</p>}
            {r2 && (
              <>
                <p className="admin-resume">{r2.resume}</p>
                <p className="notice">
                  <b>{RESSEMBLANCE[r2.ressemblance]}</b>
                  {r2.deja_bon.length > 0 && <> · Déjà bon : {r2.deja_bon.join(", ")}</>}
                </p>
                <div className="rapport-cols">
                  <div>
                    <h4>Réparable dans Blender ({r2.blender.length})</h4>
                    <div className="admin-diffs">
                      {r2.blender.map((d, i) => (
                        <div key={i} className={`admin-diff imp-${d.importance}`}>
                          <div className="admin-diff-head">
                            <strong>{d.probleme}</strong>
                          </div>
                          <p>{d.correction}</p>
                          <span className="sub">
                            {d.ou} · importance {d.importance}
                          </span>
                        </div>
                      ))}
                      {!r2.blender.length && <p className="notice">Rien à retoucher.</p>}
                    </div>
                  </div>
                  <div>
                    <h4>Formes 3D à ajouter ({r2.formes_3d.length})</h4>
                    <div className="admin-diffs">
                      {r2.formes_3d.map((f, i) => (
                        <div key={i} className={`admin-diff imp-${f.importance}`}>
                          <div className="admin-diff-head">
                            <strong>{f.forme}</strong>
                            <span className="chip on">{SOURCE[f.source] ?? f.source}</span>
                          </div>
                          <p>{f.description}</p>
                          <span className="sub">
                            {f.ou} · {f.remplace ? "remplace une pièce" : "s'ajoute"} · importance {f.importance}
                            {f.recherche && (
                              <>
                                {" · "}
                                <a className="link" href={`https://sketchfab.com/search?q=${encodeURIComponent(f.recherche)}&type=models`} target="_blank" rel="noreferrer">
                                  chercher « {f.recherche} »
                                </a>
                              </>
                            )}
                          </span>
                        </div>
                      ))}
                      {!r2.formes_3d.length && <p className="notice">Aucune forme à ajouter.</p>}
                    </div>
                  </div>
                </div>
                {r2.alertes.length > 0 && (
                  <>
                    <h4>Alertes</h4>
                    <ul className="admin-list">{r2.alertes.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  </>
                )}
              </>
            )}
            {couleursGlb && <div className="admin-actions">{redo("rapport2", rapport2 ? "Refaire le 2e rapport" : "Lancer le 2e rapport", doRapport2)}</div>}
          </>
        )}

        {sel === "v2" && (
          <>
            <p className="notice">
              <b>La V2 se fait dans le chat du projet</b> (Vercel ne fait pas tourner Blender). Donne à Claude la voiture repeinte et le numéro de commande :
              il applique les corrections « réparable dans Blender » du 2e rapport et te rend la V2 en .glb. Dès que tu la déposes, le 3e rapport part tout seul.
            </p>
            <ul className="admin-list">
              <li>
                Voiture repeinte :{" "}
                {couleursGlb ? <a className="link" href={photoSrc(couleursGlb)} download={`couleurs-${id}.glb`}>couleurs.glb</a> : "pas encore faite"}
              </li>
              <li>2e rapport : {r2 ? `${r2.blender.length} correction(s) Blender` : "pas encore fait"}</li>
              <li>Commande : <code>{id}</code></li>
            </ul>
            {fichiers.v2 && (
              <>
                <GlbViewer src={photoSrc(fichiers.v2)} colors />
                <p className="sub">
                  <a className="link" href={photoSrc(fichiers.v2)} download={`v2-${id}.glb`}>Télécharger la V2</a>
                </p>
              </>
            )}
            <div className="admin-actions">
              {glbDrop("v2", fichiers.v2 ? "Remplacer la V2" : "Déposer la V2 (.glb)", true)}
              {!fichiers.v2 && couleursGlb && !rapport3 && (
                <button className="link" disabled={Boolean(busy)} onClick={doRapport3}>
                  Passer la V2 : faire le 3e rapport sur la voiture repeinte
                </button>
              )}
            </div>
          </>
        )}

        {sel === "rapport3" && (
          <>
            {!v2Glb && <p className="notice">Il faut d&apos;abord la V2.</p>}
            {(step.busy || busy === "rapport3") && <p className="notice">Claude compare la V2 aux photos, le rapport s&apos;affiche ici tout seul.</p>}
            {step.state === "error" && <p className="notice err">Rapport impossible : {step.note}</p>}
            {r3 && (
              <>
                <p className="admin-resume">{r3.resume}</p>
                <div className="rapport-cols">
                  {(["essentiel", "secondaire"] as const).map((imp) => (
                    <div key={imp}>
                      <h4>
                        {imp === "essentiel" ? "Essentiel" : "Secondaire (on peut laisser)"} ({r3.manques.filter((m) => m.importance === imp).length})
                      </h4>
                      <div className="admin-diffs">
                        {r3.manques
                          .filter((m) => m.importance === imp)
                          .map((m, i) => (
                            <div key={i} className={`admin-diff imp-${imp === "essentiel" ? "haute" : "basse"}`}>
                              <div className="admin-diff-head">
                                <strong>{m.element}</strong>
                                <span className="chip on">{SOLUTION3[m.solution] ?? m.solution}</span>
                              </div>
                              <span className="sub">{m.ou}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="sub">Pièces choisies pour Meshy : {r3.meshy.length ? r3.meshy.map((m) => m.piece).join(", ") : "aucune"} (bloc Pièces Meshy).</p>
              </>
            )}
            {v2Glb && <div className="admin-actions">{redo("rapport3", rapport3 ? "Refaire le 3e rapport" : "Lancer le 3e rapport", doRapport3)}</div>}
          </>
        )}

        {sel === "meshy" && (
          <>
            {!r3 && <p className="notice">Il faut d&apos;abord le 3e rapport.</p>}
            {r3 && !r3.meshy.length && <p className="notice">Rien d&apos;essentiel à faire générer.</p>}
            {r3 && r3.meshy.length > 0 && <MeshyPieces id={id} r3={r3} crops={rapport3?.crops} pieces={pieces} />}
          </>
        )}

        {sel === "retouches" && (
          <>
            <p className="notice">
              <b>L&apos;assemblage se fait dans le chat du projet</b> (Vercel ne fait pas tourner Blender). Donne à Claude la V2 et les pièces Meshy :
              il les pose, les met à l&apos;échelle et aux bonnes couleurs, et te rend la miniature en .glb.
            </p>
            <ul className="admin-list">
              <li>
                Modèle de base :{" "}
                {baseGlb ? <a className="link" href={photoSrc(baseGlb)} download={`base-${id}.glb`}>base.glb</a> : "pas encore là"}
              </li>
              <li>
                Voiture repeinte :{" "}
                {couleursGlb ? <a className="link" href={photoSrc(couleursGlb)} download={`couleurs-${id}.glb`}>couleurs.glb</a> : "pas encore faite"}
              </li>
              <li>
                V2 : {fichiers.v2 ? <a className="link" href={photoSrc(fichiers.v2)} download={`v2-${id}.glb`}>v2.glb</a> : "pas encore déposée"}
              </li>
              <li>
                Pièces Meshy :{" "}
                {retained3d(pieces).length
                  ? retained3d(pieces)
                      .map((j, k) => (
                        <span key={j.index}>
                          {k > 0 && ", "}
                          <a className="link" href={photoSrc(j.glb!)} download={`piece-${j.index + 1}-${id}.glb`}>{j.piece}</a>
                        </span>
                      ))
                  : "aucune pour l'instant"}
              </li>
              <li>Commande : <code>{id}</code></li>
            </ul>
            {fichiers.final && (
              <>
                <h4>Miniature terminée</h4>
                <GlbViewer src={photoSrc(fichiers.final)} colors />
                <p className="sub">
                  Regarde-la sous tous les angles avant de l&apos;envoyer au client.{" "}
                  <a className="link" href={photoSrc(fichiers.final)} download={`miniature-${id}.glb`}>Télécharger</a>
                </p>
              </>
            )}
            <div className="admin-actions">{glbDrop("final", fichiers.final ? "Remplacer la miniature" : "Déposer la miniature (.glb)", true)}</div>
          </>
        )}

        {sel === "controle" && (
          <>
            {!fichiers.final && <p className="notice">Il faut d&apos;abord déposer la miniature terminée (étape Assemblage final).</p>}
            {(step.busy || busy === "controle") && <p className="notice">Claude compare la miniature aux photos, le score s&apos;affiche ici tout seul.</p>}
            {controle?.status === "error" && <p className="notice err">Contrôle impossible : {controle.error}</p>}
            {controle?.result && lastEssai && (
              <>
                <p className={`controle-score ${lastEssai.valide ? "ok" : "ko"}`}>
                  <b>{controle.result.score} %</b> de ressemblance{" "}
                  {lastEssai.valide ? "· validée, tu peux envoyer le rendu" : `· pas assez (il faut plus de ${CONTROLE.seuil} %) : rien ne part`}
                </p>
                {lastEssai.glb !== fichiers.final && <p className="notice">Une nouvelle miniature a été déposée depuis ce contrôle.</p>}
                <p className="admin-resume">{controle.result.resume}</p>
                {controle.result.points_ok.length > 0 && <p className="sub">Réussi : {controle.result.points_ok.join(" · ")}</p>}
                {(["bloquant", "a_corriger", "detail"] as const).map((g) => {
                  const list = controle.result!.ecarts.filter((e) => e.gravite === g);
                  if (!list.length) return null;
                  return (
                    <div key={g}>
                      <h4>
                        {GRAVITE[g]} ({list.length})
                      </h4>
                      <div className="admin-diffs">
                        {list.map((e, i) => (
                          <div key={i} className={`admin-diff imp-${g === "bloquant" ? "haute" : g === "a_corriger" ? "moyenne" : "basse"}`}>
                            <div className="admin-diff-head">
                              <strong>{e.element}</strong>
                              <span className="chip on">{CORRECTION[e.correction] ?? e.correction}</span>
                            </div>
                            <span className="sub">{e.ou}</span>
                            <span>{e.consigne}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {!lastEssai.valide && !essaisFinis && (
                  <p className="notice">
                    <b>La boucle :</b> donne ce contrôle à Claude dans le chat du projet avec la commande <code>{id}</code>. Il corrige la miniature dans Blender,
                    tu la redéposes à l&apos;étape Assemblage final, et le contrôle repart tout seul (essai {essais.length}/{CONTROLE.maxEssais}).
                  </p>
                )}
                {!lastEssai.valide && essaisFinis && (
                  <p className="notice err">
                    {CONTROLE.maxEssais} essais sans dépasser {CONTROLE.seuil} % : la boucle s&apos;arrête. À toi de décider : envoyer quand même, ou corriger encore et relancer à la main.
                  </p>
                )}
              </>
            )}
            {essais.length > 0 && (
              <p className="sub">
                Essais : {essais.map((e, i) => `n° ${i + 1} ${e.score} %${e.valide ? " ✓" : ""}`).join(" · ")}
              </p>
            )}
            {fichiers.final && (
              <div className="admin-actions">
                {redo("controle", essaisFinis ? "Relancer le contrôle quand même" : controle ? "Refaire le contrôle" : "Lancer le contrôle", () => doControle(essaisFinis))}
              </div>
            )}
          </>
        )}

        {def.manual && (
          <div className="admin-actions">
            {suivi[def.manual] ? (
              <>
                <span className="node-ok">Fait le {day(suivi[def.manual])}</span>
                <button className="link" disabled={Boolean(busy)} onClick={() => call(sel, "/api/admin/suivi", { id, step: def.manual, done: false })}>
                  Annuler
                </button>
              </>
            ) : (
              <>
                {/* Le rendu ne part au client qu'après un contrôle validé ; après tous les essais, c'est au propriétaire de trancher. */}
                {def.manual === "rendu" && !controleValide && (
                  <span className="notice err">
                    {essaisFinis ? "Contrôle non validé : tu peux envoyer quand même, en connaissance de cause." : `Bloqué : le contrôle de ressemblance doit dépasser ${CONTROLE.seuil} %.`}
                  </span>
                )}
                <button
                  className="cta"
                  disabled={Boolean(busy) || (def.manual === "rendu" && !controleValide && !essaisFinis)}
                  onClick={() => call(sel, "/api/admin/suivi", { id, step: def.manual, done: true })}
                >
                  {busy === sel ? "…" : def.manual === "rendu" && !controleValide && essaisFinis ? "Envoyer quand même" : "C'est fait"}
                </button>
              </>
            )}
          </div>
        )}
        {error && <p className="notice err">{error}</p>}
      </div>
    </section>
  );
}
