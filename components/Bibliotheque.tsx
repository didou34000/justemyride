"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import GlbViewer from "./GlbViewer";
import { photoSrc } from "@/lib/photo";
import { sendFile } from "@/lib/uploadClient";
import { SORTES, taille, type Element, type Sorte } from "@/lib/bibliothequeShared";

const ORIGINES = { meshy: "Meshy", blender: "Blender", fichier: "Déposée" } as const;

/**
 * Page Bibliothèque de l'admin : toutes les pièces 3D déjà faites, en grandes vignettes avec leur nom.
 * Filtre par sorte, recherche par nom ou voiture, aperçu 3D au clic, téléchargement, modification, ajout d'un .glb.
 */
export default function Bibliotheque({ initial, storage }: { initial: Element[]; storage: boolean }) {
  const [elements, setElements] = useState(initial);
  const [sorte, setSorte] = useState<Sorte | "">("");
  const [q, setQ] = useState("");
  const [vue3d, setVue3d] = useState("");
  const [edit, setEdit] = useState<Element | null>(null);
  const [ajout, setAjout] = useState({ nom: "", sorte: "roue" as Sorte, voitures: "" });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return elements.filter((e) => (!sorte || e.sorte === sorte) && (!t || `${e.nom} ${e.voitures.join(" ")}`.toLowerCase().includes(t)));
  }, [elements, sorte, q]);
  const total = elements.reduce((t, e) => t + (e.octets ?? 0), 0);

  async function post(key: string, body: object) {
    setBusy(key);
    setError("");
    try {
      const res = await fetch("/api/admin/bibliotheque", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `Erreur ${res.status}`);
      setElements(d.elements);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy("");
    }
  }

  async function deposer(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ajout.nom.trim()) return setError("Donne d'abord un nom à la pièce.");
    setBusy("ajout");
    setError("");
    try {
      const { mode } = await fetch("/api/storage").then((r) => r.json());
      if (!mode) throw new Error("Stockage non configuré");
      const name = file.name.replace(/\.glb$/i, "").replace(/[^\w.-]+/g, "-").slice(0, 60) || "piece";
      const { pathname } = await sendFile(`bibliotheque/depot/${name}.glb`, file, { mode, handleUploadUrl: "/api/admin/upload", contentType: "model/gltf-binary" });
      if (await post("ajout", { action: "ajouter", pathname, ...ajout })) setAjout({ nom: "", sorte: ajout.sorte, voitures: "" });
    } catch (err) {
      setError((err as Error).message);
      setBusy("");
    }
  }

  return (
    <>
      <p className="sub">
        Tout ce qu&apos;on a déjà fait en 3D reste ici : {elements.length} pièce{elements.length > 1 ? "s" : ""}, {taille(total) || "0 Ko"} en tout. Chaque pièce 3D
        livrée par Meshy y entre toute seule (Meshy efface ses modèles au bout de 3 jours : c&apos;est notre copie, allégée, qui compte). Dans une commande, le
        bloc Pièces Meshy propose les pièces d&apos;ici qui vont avec : les reprendre ne coûte aucun crédit.
      </p>
      {error && <p className="notice err">{error}</p>}

      <div className="biblio-bar">
        <div className="chips">
          <button type="button" className={`chip${sorte === "" ? " on" : ""}`} onClick={() => setSorte("")}>
            Tout <em>{elements.length}</em>
          </button>
          {(Object.keys(SORTES) as Sorte[]).map((s) => {
            const n = elements.filter((e) => e.sorte === s).length;
            return n ? (
              <button key={s} type="button" className={`chip${sorte === s ? " on" : ""}`} onClick={() => setSorte(s)}>
                {SORTES[s]} <em>{n}</em>
              </button>
            ) : null;
          })}
        </div>
        <input className="biblio-search" type="search" placeholder="Chercher un nom ou une voiture…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {!shown.length && <p className="notice">Aucune pièce ne correspond.</p>}
      <div className="biblio-grid">
        {shown.map((e) => (
          <article key={e.id} className="biblio-card">
            <div className="biblio-visu">
              {vue3d === e.id ? (
                <GlbViewer src={photoSrc(e.glb)} colors={e.origine !== "meshy" || Boolean(e.fournie)} />
              ) : e.apercu ? (
                <button type="button" className="biblio-thumb" onClick={() => setVue3d(e.id)} title="Voir en 3D">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoSrc(e.apercu)} alt={e.nom} loading="lazy" />
                </button>
              ) : (
                <button type="button" className="biblio-thumb empty" onClick={() => setVue3d(e.id)}>
                  Voir en 3D
                </button>
              )}
            </div>
            <div className="biblio-body">
              <h3>{e.nom}</h3>
              <p className="biblio-meta">
                <span className="chip on">{SORTES[e.sorte]}</span>
                {e.voitures.length ? e.voitures.join(", ") : "Toutes voitures"}
              </p>
              <p className="biblio-meta">
                {ORIGINES[e.origine]} · {taille(e.octets)}
                {e.credits ? ` · ${e.credits} crédits` : ""}
                {e.depuis && ` · commande ${e.depuis.demande.slice(0, 8)}`}
              </p>
              {e.attention && <p className="biblio-attention">{e.attention}</p>}
              <div className="biblio-actions">
                <button type="button" className="link" onClick={() => setVue3d(vue3d === e.id ? "" : e.id)}>
                  {vue3d === e.id ? "Fermer la 3D" : "Voir en 3D"}
                </button>
                <a className="link" href={photoSrc(e.glb)} download={`${e.id}.glb`}>
                  .glb
                </a>
                {storage && (
                  <>
                    <button type="button" className="link" onClick={() => setEdit(edit?.id === e.id ? null : { ...e })}>
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="link"
                      disabled={Boolean(busy)}
                      onClick={() => window.confirm(`Retirer « ${e.nom} » de la bibliothèque ?`) && post(`rm${e.id}`, { action: "retirer", element: e.id })}
                    >
                      Retirer
                    </button>
                  </>
                )}
              </div>
              {edit?.id === e.id && (
                <form
                  className="biblio-form"
                  onSubmit={async (ev) => {
                    ev.preventDefault();
                    if (await post(`ed${e.id}`, { action: "modifier", element: e.id, nom: edit.nom, sorte: edit.sorte, voitures: edit.voitures, attention: edit.attention ?? "" }))
                      setEdit(null);
                  }}
                >
                  <input value={edit.nom} onChange={(ev) => setEdit({ ...edit, nom: ev.target.value })} placeholder="Nom" />
                  <select value={edit.sorte} onChange={(ev) => setEdit({ ...edit, sorte: ev.target.value as Sorte })}>
                    {Object.entries(SORTES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <input
                    value={edit.voitures.join(", ")}
                    onChange={(ev) => setEdit({ ...edit, voitures: ev.target.value.split(",").map((x) => x.trimStart()) })}
                    placeholder="Voitures (séparées par des virgules)"
                  />
                  <input value={edit.attention ?? ""} onChange={(ev) => setEdit({ ...edit, attention: ev.target.value })} placeholder="Rappel (ex. vrai logo de marque)" />
                  <button className="cta" disabled={Boolean(busy)}>
                    {busy === `ed${e.id}` ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </form>
              )}
            </div>
          </article>
        ))}
      </div>

      <h3>Ajouter une pièce</h3>
      {storage ? (
        <>
          <p className="sub">
            Pour une pièce faite dans Blender ou trouvée ailleurs : donne-lui un nom, puis choisis le .glb. Il est allégé avant d&apos;être rangé (le fichier
            d&apos;origine n&apos;est pas gardé).
          </p>
          <div className="biblio-form">
            <input value={ajout.nom} onChange={(e) => setAjout({ ...ajout, nom: e.target.value })} placeholder="Nom (ex. Jante BBS 15 pouces dorée)" />
            <select value={ajout.sorte} onChange={(e) => setAjout({ ...ajout, sorte: e.target.value as Sorte })}>
              {Object.entries(SORTES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input value={ajout.voitures} onChange={(e) => setAjout({ ...ajout, voitures: e.target.value })} placeholder="Voitures (séparées par des virgules)" />
            <label className={`cta ${busy ? "off" : ""}`}>
              {busy === "ajout" ? "Envoi et allègement…" : "Choisir le .glb"}
              <input type="file" accept=".glb,model/gltf-binary" hidden disabled={Boolean(busy)} onChange={deposer} />
            </label>
          </div>
        </>
      ) : (
        <p className="notice">Le stockage n&apos;est pas branché : seules les pièces fournies avec le site s&apos;affichent, sans ajout possible.</p>
      )}
    </>
  );
}
