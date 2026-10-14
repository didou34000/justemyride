"use client";

import { useState } from "react";
import CarPreview from "./CarPreview";
import Plate from "./Plate";
import {
  accessories,
  colors,
  finishes,
  priceOf,
  sizes,
  spoilers,
  wheelColors,
  wheelStyles,
  type Config,
} from "@/lib/options";

const initial: Config = {
  make: "",
  model: "",
  year: "",
  color: colors[3].hex,
  colorName: colors[3].label,
  finish: "brillant",
  wheelStyle: "cinq",
  wheelColor: "noir",
  spoiler: "aucun",
  plate: "",
  accessories: [],
  size: "1-24",
};

export default function Configurator() {
  const [c, setC] = useState<Config>(initial);
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
    <section id="configurer" className="config">
      <div className="stage">
        <div className="stage-inner">
          <p className="eyebrow">Aperçu</p>
          <CarPreview config={c} />
          <div className="stage-meta">
            <span>{[c.make, c.model, c.year].filter(Boolean).join(" ") || "Ta voiture"}</span>
            <span>
              {size.label} · {size.length}
            </span>
          </div>
          <Plate text={c.plate} />
          <p className="hint">Aperçu indicatif. Le modèle 3D de ta voiture arrive bientôt ici.</p>
        </div>
      </div>

      <div className="panel">
        <Step n={1} title="Ta voiture">
          <div className="row3">
            <input placeholder="Marque" value={c.make} onChange={(e) => set("make", e.target.value)} />
            <input placeholder="Modèle" value={c.model} onChange={(e) => set("model", e.target.value)} />
            <input
              placeholder="Année"
              inputMode="numeric"
              maxLength={4}
              value={c.year}
              onChange={(e) => set("year", e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </Step>

        <Step n={2} title="Peinture">
          <div className="swatches">
            {colors.map((col) => (
              <button
                key={col.id}
                className={`swatch ${c.color === col.hex ? "on" : ""}`}
                style={{ background: col.hex }}
                title={col.label}
                aria-label={col.label}
                onClick={() => setC((p) => ({ ...p, color: col.hex, colorName: col.label }))}
              />
            ))}
            <label className="swatch custom" title="Couleur personnalisée">
              <input
                type="color"
                value={c.color}
                onChange={(e) => setC((p) => ({ ...p, color: e.target.value, colorName: "Personnalisée" }))}
              />
              +
            </label>
          </div>
          <p className="sub">{c.colorName}</p>
          <Chips options={finishes} value={c.finish} onChange={(v) => set("finish", v)} />
        </Step>

        <Step n={3} title="Jantes">
          <Chips options={wheelStyles} value={c.wheelStyle} onChange={(v) => set("wheelStyle", v)} />
          <div className="swatches small">
            {wheelColors.map((w) => (
              <button
                key={w.id}
                className={`swatch ${c.wheelColor === w.id ? "on" : ""}`}
                style={{ background: w.hex }}
                title={w.label}
                aria-label={w.label}
                onClick={() => set("wheelColor", w.id)}
              />
            ))}
          </div>
        </Step>

        <Step n={4} title="Aileron">
          <Chips options={spoilers} value={c.spoiler} onChange={(v) => set("spoiler", v)} />
        </Step>

        <Step n={5} title="Immatriculation">
          <input
            className="plate-input"
            placeholder="AB-123-CD"
            maxLength={10}
            value={c.plate}
            onChange={(e) => set("plate", e.target.value.toUpperCase())}
          />
        </Step>

        <Step n={6} title="Taille">
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

        <Step n={7} title="Finitions">
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
        <span>{String(n).padStart(2, "0")}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string; price?: number }[];
  value: string;
  onChange: (v: string) => void;
}) {
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
