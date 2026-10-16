"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CarViewer, { SKETCHFAB, type Caps, type ModelSource, type PickRole } from "./CarViewer";
import PartSearch, { type Part } from "./PartSearch";
import {
  accessories,
  caliperColors,
  colors,
  exhausts,
  finishes,
  ORIGINE,
  priceOf,
  rimStyles,
  sizes,
  wheelColors,
  type Config,
  type Option,
} from "@/lib/options";

export type ConfigModel = {
  key: string;
  name: string;
  subtitle: string;
  url: string;
  zip?: boolean;
  lengthM?: number;
  roles?: ModelSource["roles"];
  /** Modèle Sketchfab : crédit obligatoire + rôles devinés que le client peut corriger. */
  credit?: { name: string; author: string; authorUrl?: string; licence: string; viewerUrl: string };
};

const pickLabels: Record<PickRole, string> = { paint: "Carrosserie", rims: "Jantes", calipers: "Étriers" };

const TABS = [
  { id: "rims", label: "Jantes" },
  { id: "exhaust", label: "Échappement" },
  { id: "paint", label: "Couleur" },
  { id: "size", label: "Taille" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function Configurator3D({ model }: { model: ConfigModel }) {
  const source = useMemo<ModelSource>(
    () => ({ url: model.url, zip: model.zip, lengthM: model.lengthM, roles: model.roles }),
    [model.url, model.zip, model.lengthM, model.roles]
  );
  const [caps, setCaps] = useState<Caps | null>(null);
  const [pick, setPick] = useState<PickRole | null>(null);
  const [c, setC] = useState<Config>({
    car: model.key,
    carName: model.name,
    source: model.credit?.viewerUrl,
    paint: ORIGINE,
    paintName: "D'origine",
    finish: "metal",
    rims: ORIGINE,
    rimColor: ORIGINE,
    exhaust: ORIGINE,
    caliper: ORIGINE,
    size: "1-24",
    accessories: [],
  });
  const [rimPart, setRimPart] = useState<Part | null>(null);
  const [exPart, setExPart] = useState<Part | null>(null);
  const [partStatus, setPartStatus] = useState({ rim: "", exhaust: "" });
  const parts = useMemo(
    () => ({
      rim: c.rims === SKETCHFAB && rimPart ? { url: rimPart.url, zip: rimPart.zip, adjust: rimPart.adjust } : null,
      exhaust: c.exhaust === SKETCHFAB && exPart ? { url: exPart.url, zip: exPart.zip, adjust: exPart.adjust } : null,
    }),
    [c.rims, c.exhaust, rimPart, exPart]
  );
  const chooseRim = (p: Part | null) => {
    setRimPart(p);
    setC((x) => ({ ...x, rims: p ? SKETCHFAB : ORIGINE, rimPart: p ? `${p.name} — ${p.viewerUrl}` : undefined }));
  };
  const chooseExhaust = (p: Part | null) => {
    setExPart(p);
    setC((x) => ({ ...x, exhaust: p ? SKETCHFAB : ORIGINE, exhaustPart: p ? `${p.name} — ${p.viewerUrl}` : undefined }));
  };
  const [status, setStatus] = useState<"idle" | "loading" | "demo" | "error">("idle");
  const [error, setError] = useState("");

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setC((p) => ({ ...p, [k]: v }));
  const total = priceOf(c);
  const size = sizes.find((s) => s.id === c.size)!;

  const [tab, setTab] = useState<TabId>("rims");
  const [seen, setSeen] = useState<TabId[]>([]);
  const go = (t: TabId) => {
    setSeen((s) => (s.includes(tab) ? s : [...s, tab]));
    setTab(t);
  };
  const next = TABS[TABS.findIndex((t) => t.id === tab) + 1];

  async function order() {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      });
      const data = await res.json();
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
      else if (data.demo) setStatus("demo");
      else throw new Error(data.error ?? "Erreur inconnue");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }

  return (
    <section className="config">
      <div className="stage">
        <div className="stage-inner viewer-wrap">
          <CarViewer
            source={source}
            config={c}
            pick={pick}
            onCaps={setCaps}
            onPicked={() => setPick(null)}
            parts={parts}
            onPartStatus={(k, v) => setPartStatus((s) => ({ ...s, [k]: v }))}
            framing={1.35}
          />
          <div className="stage-meta">
            <span>
              {model.name} · {model.subtitle}
            </span>
            <span>
              {size.label} · {size.length}
            </span>
          </div>
          {model.credit && (
            <p className="credit">
              Modèle de base « {model.credit.name} » par{" "}
              {model.credit.authorUrl ? <a href={model.credit.authorUrl} target="_blank" rel="noreferrer">{model.credit.author}</a> : model.credit.author}{" "}
              ({model.credit.licence}), fourni par{" "}
              <a href={model.credit.viewerUrl} target="_blank" rel="noreferrer">Sketchfab</a>.
            </p>
          )}
          {[parts.rim && rimPart, parts.exhaust && exPart].filter(Boolean).map((p) => (
            <p className="credit" key={(p as Part).uid}>
              Pièce « {(p as Part).name} » par{" "}
              {(p as Part).authorUrl ? <a href={(p as Part).authorUrl} target="_blank" rel="noreferrer">{(p as Part).author}</a> : (p as Part).author}{" "}
              ({(p as Part).licence}), fournie par <a href={(p as Part).viewerUrl} target="_blank" rel="noreferrer">Sketchfab</a>.
            </p>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <Link href="/configurer" className="link">← Changer de voiture</Link>
          <h2>
            {model.name} <small>{model.subtitle}</small>
          </h2>
        </div>

        {model.credit && (
          <div className="fix">
            <p className="sub">
              {pick
                ? `Clique sur ${pick === "paint" ? "la carrosserie" : pick === "rims" ? "une jante" : "un étrier"} dans la 3D.`
                : "Une couleur ne va pas au bon endroit ? Choisis la pièce, puis clique dessus dans la 3D."}
            </p>
            <div className="chips">
              {(Object.keys(pickLabels) as PickRole[]).map((k) => (
                <button key={k} className={`chip ${pick === k ? "on" : ""}`} onClick={() => setPick(pick === k ? null : k)}>
                  {pickLabels[k]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`tab ${tab === t.id ? "on" : ""}`}
              onClick={() => go(t.id)}
            >
              {seen.includes(t.id) && tab !== t.id && <span className="ok">✓</span>}
              {t.label}
            </button>
          ))}
        </div>

        <div className="tab-body">
          {tab === "rims" && (
            <Step title="Jantes" desc="Garde celles d'origine ou change de style, puis choisis leur couleur.">
              {caps?.rimStyles !== false ? (
                <>
                  <Chips options={rimStyles} value={c.rims} onChange={(v) => set("rims", v)} />
                  <details className="more" open={c.rims === SKETCHFAB}>
                    <summary>Plus de jantes : chercher une vraie jante</summary>
                    <p className="sub">Trouvée sur Sketchfab et posée sur tes 4 roues.</p>
                    <PartSearch kind="rim" part={c.rims === SKETCHFAB ? rimPart : null} status={partStatus.rim} onChange={chooseRim} />
                  </details>
                </>
              ) : (
                <p className="sub">Jantes de rechange indisponibles sur ce modèle : on garde celles d'origine.</p>
              )}
              {caps?.rims !== false && (
                <>
                  <p className="label">Couleur des jantes</p>
                  <Swatches list={wheelColors} value={c.rimColor} onChange={(v) => set("rimColor", v)} small />
                </>
              )}
              {caps?.calipers !== false && (
                <>
                  <p className="label">Étriers de frein</p>
                  <Swatches list={caliperColors} value={c.caliper} onChange={(v) => set("caliper", v)} small />
                </>
              )}
            </Step>
          )}

          {tab === "exhaust" && (
            <Step title="Échappement" desc="Le détail qui change tout à l'arrière.">
              {caps?.exhaust !== false ? (
                <>
                  <Chips options={exhausts} value={c.exhaust} onChange={(v) => set("exhaust", v)} />
                  <details className="more" open={c.exhaust === SKETCHFAB}>
                    <summary>Plus d'échappements : chercher un vrai modèle</summary>
                    <p className="sub">Trouvé sur Sketchfab et posé sur chaque sortie.</p>
                    <PartSearch kind="exhaust" part={c.exhaust === SKETCHFAB ? exPart : null} status={partStatus.exhaust} onChange={chooseExhaust} />
                  </details>
                </>
              ) : (
                <p className="sub">Échappement non repéré sur ce modèle : on garde celui d'origine.</p>
              )}
            </Step>
          )}

          {tab === "paint" && (
            <Step title="Couleur" desc="Une teinte, une finition. Ou la couleur exacte de ta voiture.">
              <div className="swatches">
                <button
                  className={`swatch origin ${c.paint === ORIGINE ? "on" : ""}`}
                  title="Couleur d'origine du modèle"
                  aria-label="Couleur d'origine"
                  onClick={() => setC((p) => ({ ...p, paint: ORIGINE, paintName: "D'origine" }))}
                >
                  ↺
                </button>
                {colors.map((col) => (
                  <button
                    key={col.id}
                    className={`swatch ${c.paint === col.hex ? "on" : ""}`}
                    style={{ background: col.hex }}
                    title={col.label}
                    aria-label={col.label}
                    onClick={() => setC((p) => ({ ...p, paint: col.hex, paintName: col.label }))}
                  />
                ))}
                <label className="swatch custom" title="Couleur personnalisée">
                  <input
                    type="color"
                    value={c.paint === ORIGINE ? "#1f3f8f" : c.paint}
                    onChange={(e) => setC((p) => ({ ...p, paint: e.target.value, paintName: "Personnalisée" }))}
                  />
                  +
                </label>
              </div>
              <p className="paint-name">{c.paintName}</p>
              <p className="label">Finition</p>
              <Chips options={finishes} value={c.finish} onChange={(v) => set("finish", v)} />
            </Step>
          )}

          {tab === "size" && (
            <Step title="Taille et finitions" desc="La taille fixe le prix. Le socle et la vitrine sont en option.">
              <div className="sizes">
                {sizes.map((s) => (
                  <button key={s.id} className={`size ${c.size === s.id ? "on" : ""}`} onClick={() => set("size", s.id)}>
                    <strong>{s.label}</strong>
                    <span>{s.length}</span>
                    <em>{s.price} €</em>
                  </button>
                ))}
              </div>
              <p className="label">Finitions</p>
              <div className="checks">
                {accessories.map((a) => (
                  <label key={a.id} className="check">
                    <input
                      type="checkbox"
                      checked={c.accessories.includes(a.id)}
                      onChange={(e) =>
                        set(
                          "accessories",
                          e.target.checked ? [...c.accessories, a.id] : c.accessories.filter((x) => x !== a.id)
                        )
                      }
                    />
                    <span>{a.label}</span>
                    <em>+{a.price} €</em>
                  </label>
                ))}
              </div>
            </Step>
          )}
        </div>

        {(status === "demo" || status === "error") && (
          <div className="checkout-notes">
            {status === "demo" && (
              <p className="notice">
                Mode démo : le paiement Shopify n'est pas encore branché. Ta configuration est prête à être envoyée.
              </p>
            )}
            {status === "error" && <p className="notice err">{error}</p>}
          </div>
        )}

        <div className="checkout">
          <div>
            <small>
              {size.label} · {size.length}
            </small>
            <p className="total">{total} €</p>
          </div>
          {next ? (
            <button className="cta" onClick={() => go(next.id)}>
              Suivant : {next.label} →
            </button>
          ) : (
            <button className="cta accent" onClick={order} disabled={status === "loading"}>
              {status === "loading" ? "…" : "Commander"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function Step({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="step">
      <h3>{title}</h3>
      <p className="desc">{desc}</p>
      {children}
    </div>
  );
}

function Chips({ options, value, onChange }: { options: Option[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o.id} className={`chip ${value === o.id ? "on" : ""}`} onClick={() => onChange(o.id)}>
          {o.label}
          {o.price ? <em> +{o.price} €</em> : null}
        </button>
      ))}
    </div>
  );
}

function Swatches({
  list,
  value,
  onChange,
  small,
}: {
  list: { id: string; label: string; hex: string }[];
  value: string;
  onChange: (v: string) => void;
  small?: boolean;
}) {
  return (
    <div className={`swatches ${small ? "tight" : ""}`}>
      <button
        className={`swatch origin ${value === ORIGINE ? "on" : ""}`}
        title="D'origine"
        aria-label="D'origine"
        onClick={() => onChange(ORIGINE)}
      >
        ↺
      </button>
      {list.map((w) => (
        <button
          key={w.id}
          className={`swatch ${value === w.id ? "on" : ""}`}
          style={{ background: w.hex }}
          title={w.label}
          aria-label={w.label}
          onClick={() => onChange(w.id)}
        />
      ))}
    </div>
  );
}
