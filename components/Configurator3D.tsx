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
        <Link href="/configurer" className="link back">← Changer de voiture</Link>

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

        <Step n={1} title="Jantes">
          {caps?.rimStyles !== false ? (
            <>
              <Chips options={rimStyles} value={c.rims} onChange={(v) => set("rims", v)} />
              <p className="sub">Ou une vraie jante, trouvée sur Sketchfab et posée sur tes 4 roues :</p>
              <PartSearch kind="rim" part={c.rims === SKETCHFAB ? rimPart : null} status={partStatus.rim} onChange={chooseRim} />
            </>
          ) : (
            <p className="sub">Jantes de rechange indisponibles sur ce modèle : on garde celles d'origine.</p>
          )}
          {caps?.rims !== false && (
            <>
              <p className="sub">Couleur des jantes</p>
              <Swatches list={wheelColors} value={c.rimColor} onChange={(v) => set("rimColor", v)} small />
            </>
          )}
        </Step>

        <Step n={2} title="Échappement">
          {caps?.exhaust !== false ? (
            <>
              <Chips options={exhausts} value={c.exhaust} onChange={(v) => set("exhaust", v)} />
              <p className="sub">Ou un vrai échappement, trouvé sur Sketchfab et posé sur chaque sortie :</p>
              <PartSearch kind="exhaust" part={c.exhaust === SKETCHFAB ? exPart : null} status={partStatus.exhaust} onChange={chooseExhaust} />
            </>
          ) : (
            <p className="sub">Échappement non repéré sur ce modèle : on garde celui d'origine.</p>
          )}
        </Step>

        <Step n={3} title="Couleur">
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
          <p className="sub">{c.paintName}</p>
          <Chips options={finishes} value={c.finish} onChange={(v) => set("finish", v)} />
          {caps?.calipers !== false && (
            <>
              <p className="sub">Étriers de frein</p>
              <Swatches list={caliperColors} value={c.caliper} onChange={(v) => set("caliper", v)} small />
            </>
          )}
        </Step>

        <Step n={4} title="Taille">
          <div className="sizes">
            {sizes.map((s) => (
              <button key={s.id} className={`size ${c.size === s.id ? "on" : ""}`} onClick={() => set("size", s.id)}>
                <strong>{s.label}</strong>
                <span>{s.length}</span>
                <em>{s.price} €</em>
              </button>
            ))}
          </div>
        </Step>

        <Step n={5} title="Finitions">
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

        <div className="checkout">
          <div>
            <p className="sub">Total</p>
            <p className="total">{total} €</p>
          </div>
          <button className="cta" onClick={order} disabled={status === "loading"}>
            {status === "loading" ? "…" : "Commander"}
          </button>
        </div>
        {status === "demo" && (
          <p className="notice">
            Mode démo : le paiement Shopify n'est pas encore branché. Ta configuration est prête à être envoyée.
          </p>
        )}
        {status === "error" && <p className="notice err">{error}</p>}
      </div>
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="step">
      <h3>
        <span>0{n}</span>
        {title}
      </h3>
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
