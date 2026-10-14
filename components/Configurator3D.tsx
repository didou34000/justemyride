"use client";

import { useState } from "react";
import CarViewer from "./CarViewer";
import type { Car } from "@/lib/cars";
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

export default function Configurator3D({ car }: { car: Car }) {
  const [c, setC] = useState<Config>({
    car: car.slug,
    carName: `${car.make} ${car.model}`,
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
          <CarViewer car={car} config={c} />
          <div className="stage-meta">
            <span>
              {car.make} {car.model} · {car.years}
            </span>
            <span>
              {size.label} · {size.length}
            </span>
          </div>
        </div>
      </div>

      <div className="panel">
        <a href="/configurer" className="link back">← Changer de voiture</a>

        <Step n={1} title="Jantes">
          <Chips options={rimStyles} value={c.rims} onChange={(v) => set("rims", v)} />
          <p className="sub">Couleur des jantes</p>
          <Swatches list={wheelColors} value={c.rimColor} onChange={(v) => set("rimColor", v)} small />
        </Step>

        <Step n={2} title="Échappement">
          <Chips options={exhausts} value={c.exhaust} onChange={(v) => set("exhaust", v)} />
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
          <p className="sub">Étriers de frein</p>
          <Swatches list={caliperColors} value={c.caliper} onChange={(v) => set("caliper", v)} small />
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
