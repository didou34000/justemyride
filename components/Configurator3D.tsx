"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@vercel/analytics";
import Link from "next/link";
import CarViewer, { SKETCHFAB, type Caps, type ModelSource, type PickRole } from "./CarViewer";
import PartSearch, { type Part } from "./PartSearch";
import {
  accessories,
  caliperColors,
  colorGroups,
  colors,
  heights,
  roofColors,
  stripeColors,
  tints,
  trims,
  exhausts,
  finishes,
  ORIGINE,
  priceOf,
  rimStyles,
  sizes,
  wheelColors,
  CONFIG_KEY,
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

/** Chaque onglet a son angle de vue (avant = +Z) : de profil pour les jantes, de l'arrière pour l'échappement… */
const TABS = [
  { id: "rims", label: "Jantes", view: [1, 0.12, 0.18] },
  { id: "exhaust", label: "Échappement", view: [0.55, 0.2, -0.8] },
  { id: "paint", label: "Couleur", view: [0.66, 0.17, 0.73] },
  { id: "style", label: "Style", view: [0.55, 0.5, 0.65] },
  { id: "size", label: "Taille", view: [0.66, 0.17, 0.73] },
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
    tint: ORIGINE,
    trim: ORIGINE,
    height: ORIGINE,
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

  // La taille choisie sur la fiche produit (?taille=1-18) est reprise ici.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("taille");
    if (t && sizes.some((x) => x.id === t)) setC((p) => ({ ...p, size: t }));
  }, []);

  /** Un seul parcours : la configuration part avec les photos, l'aperçu est gratuit, on ne paie qu'après. */
  const router = useRouter();
  function toPreview() {
    track("Configuration envoyée", { taille: c.size, prix: priceOf(c) });
    try {
      sessionStorage.setItem(CONFIG_KEY, JSON.stringify({ ...c, price: priceOf(c) }));
    } catch {
      /* stockage indisponible : la fiche produit reprend au moins la taille */
    }
    router.push(`/miniature?taille=${c.size}#envoi`);
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
            view={[...TABS.find((t) => t.id === tab)!.view] as [number, number, number]}
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
          <h1>
            {model.name} <small>{model.subtitle}</small>
          </h1>
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
                <label className="swatch custom" title="Couleur exacte de ta voiture">
                  <input
                    type="color"
                    value={c.paint === ORIGINE ? "#1f3f8f" : c.paint}
                    onChange={(e) => setC((p) => ({ ...p, paint: e.target.value, paintName: "Personnalisée" }))}
                  />
                  +
                </label>
              </div>
              {colorGroups.map((g) => (
                <div key={g.label}>
                  <p className="label">{g.label}</p>
                  <div className="swatches">
                    {g.list.map((col) => (
                      <button
                        key={col.id}
                        className={`swatch ${c.paint === col.hex ? "on" : ""}`}
                        style={{ background: col.hex }}
                        title={col.label}
                        aria-label={col.label}
                        onClick={() => setC((p) => ({ ...p, paint: col.hex, paintName: col.label }))}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <p className="paint-name">{c.paintName}</p>
              <p className="label">Finition</p>
              <Chips options={finishes} value={c.finish} onChange={(v) => set("finish", v)} />
            </Step>
          )}

          {tab === "style" && (
            <Step title="Style" desc="Les détails qui font la différence : toit, bandes, hauteur, vitres, chromes.">
              {caps?.roof !== false && (
                <>
                  <p className="label">Toit</p>
                  <Chips
                    options={[{ id: ORIGINE, label: "Comme la carrosserie" }, ...roofColors]}
                    value={c.roof ?? ORIGINE}
                    onChange={(v) => set("roof", v)}
                  />
                </>
              )}
              {caps?.stripes !== false && (
                <>
                  <p className="label">Bandes capot et toit</p>
                  <Chips
                    options={[{ id: ORIGINE, label: "Sans" }, ...stripeColors]}
                    value={c.stripes ?? ORIGINE}
                    onChange={(v) => set("stripes", v)}
                  />
                </>
              )}
              {caps?.height !== false && (
                <>
                  <p className="label">Hauteur de caisse</p>
                  <Chips options={heights} value={c.height} onChange={(v) => set("height", v)} />
                </>
              )}
              {caps?.tint !== false && (
                <>
                  <p className="label">Vitres teintées</p>
                  <Chips options={tints} value={c.tint} onChange={(v) => set("tint", v)} />
                </>
              )}
              {caps?.trim !== false && (
                <>
                  <p className="label">Chromes</p>
                  <Chips options={trims} value={c.trim} onChange={(v) => set("trim", v)} />
                </>
              )}
              {caps && !caps.roof && !caps.height && !caps.tint && !caps.trim && (
                <p className="sub">Ces réglages ne sont pas encore disponibles sur ce modèle.</p>
              )}
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
              {c.accessories.includes("socle") && (
                <label className="engrave">
                  <span>Texte gravé sur la plaque (facultatif)</span>
                  <input
                    maxLength={32}
                    placeholder={`Ex. ${model.name}`}
                    value={c.engraving ?? ""}
                    onChange={(e) => set("engraving", e.target.value)}
                  />
                </label>
              )}
            </Step>
          )}
        </div>

        {!next && (
          <p className="order-note">
            Tu ne paies rien maintenant : envoie les photos de ta voiture, on te montre ton aperçu, et tu commandes s'il te
            plaît.
          </p>
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
            <button className="cta accent" onClick={toPreview}>
              Recevoir mon aperçu gratuit
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

function Chips({
  options,
  value,
  onChange,
}: {
  options: (Option & { hex?: string })[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o.id} className={`chip ${value === o.id ? "on" : ""}`} onClick={() => onChange(o.id)}>
          {o.hex && <i className="chip-dot" style={{ background: o.hex }} aria-hidden />}
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
