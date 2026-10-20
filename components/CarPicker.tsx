"use client";

import { useEffect, useState } from "react";
import CarSearch from "./CarSearch";
import ShelfPreview from "./ShelfPreview";
import { brandLogo, brands, type Base, type Brand, type CarModel, type Generation } from "@/lib/catalog";
import { cars } from "@/lib/cars";
import type { SketchfabHit } from "@/lib/sketchfab";

/** « Mini 3 portes (One, Cooper…) » → « 3 portes » : sans la marque ni la parenthèse. */
const short = (name: string, brand?: string) =>
  name.replace(/\s*\(.*\)$/, "").replace(new RegExp(`^${brand ?? ""}\\s+`, "i"), "");

type View = "brand" | "model" | "generation" | "preview" | "search" | "manual";

/** Logo de la marque, ou ses initiales si on n'a pas le logo. */
export function BrandMark({ id, mark }: { id: string; mark: string }) {
  const logo = brandLogo(id);
  return (
    <span className="pk-mark" aria-hidden>
      {logo ? <img src={logo} alt="" /> : mark}
    </span>
  );
}

/** Étape 0 du parcours : le client retrouve sa voiture (marque, modèle, années) avant d'envoyer ses photos. */
export default function CarPicker({ onPick }: { onPick: (b: Base) => void }) {
  const [view, setView] = useState<View>("brand");
  const [brand, setBrand] = useState<Brand | null>(null);
  const [model, setModel] = useState<CarModel | null>(null);
  const [gen, setGen] = useState<Generation | null>(null);
  const [hit, setHit] = useState<SketchfabHit | null>(null);
  const [manual, setManual] = useState("");
  const [allBrands, setAllBrands] = useState(false);

  const back: Partial<Record<View, View>> = {
    model: "brand",
    generation: "model",
    preview: hit ? "search" : "generation",
    search: brand?.models.length ? "model" : "brand",
    manual: "search",
  };

  function pickBrand(b: Brand) {
    setBrand(b);
    setModel(null);
    setGen(null);
    setHit(null);
    setView(b.models.length ? "model" : "search");
  }

  // Une marque cliquée ailleurs sur la page (grille de l'accueil) ouvre directement ses modèles.
  useEffect(() => {
    const onBrand = (e: Event) => {
      const b = brands.find((x) => x.id === (e as CustomEvent<string>).detail);
      if (b) pickBrand(b);
    };
    window.addEventListener("jmr:brand", onBrand);
    return () => window.removeEventListener("jmr:brand", onBrand);
  }, []);

  function pickModel(m: CarModel) {
    setModel(m);
    setGen(null);
    setView("generation");
  }

  const garageCar = gen?.car ? cars.find((c) => c.slug === gen.car && c.glb) : undefined;
  const label = hit
    ? hit.name
    : [brand?.name, model && short(model.name, brand?.name), gen && `${gen.label} (${gen.years})`].filter(Boolean).join(" ");

  function confirm() {
    if (hit) onPick({ label: hit.name, brand: brand?.name, uid: hit.uid, source: "recherche" });
    else
      onPick({
        label,
        brand: brand?.name,
        model: model?.name,
        generation: gen?.label,
        years: gen?.years,
        uid: gen?.uid,
        car: gen?.car,
        source: gen?.uid || gen?.car ? "annuaire" : "aucune",
      });
  }

  const notFound = (
    <button className="link pk-miss" onClick={() => setView("search")}>
      Je ne trouve pas ma voiture
    </button>
  );

  return (
    <div className="picker">
      {view !== "brand" && view !== "preview" && brand && (
        <div className="wz-head">
          <span className="wz-count">{[brand.name, model && short(model.name, brand.name)].filter(Boolean).join(" · ")}</span>
        </div>
      )}

      {view === "brand" && (
        <>
          <h2 className="wz-title">Quelle marque ?</h2>
          <div className="pk-brands">
            {(allBrands ? brands : brands.slice(0, 15)).map((b) => (
              <button key={b.id} className="pk-brand" onClick={() => pickBrand(b)}>
                <BrandMark id={b.id} mark={b.mark} />
                <span>{b.name}</span>
              </button>
            ))}
          </div>
          {allBrands ? (
            <button className="link pk-miss" onClick={() => { setBrand(null); setView("search"); }}>
              Autre marque
            </button>
          ) : (
            <button className="cta ghost pk-more" onClick={() => setAllBrands(true)}>
              Voir les {brands.length} marques
            </button>
          )}
        </>
      )}

      {view === "model" && brand && (
        <>
          <h2 className="wz-title">Quel modèle ?</h2>
          <div className="pk-list">
            {brand.models.map((m) => (
              <button key={m.id} className="pk-row" onClick={() => pickModel(m)}>
                <strong>{m.name}</strong>
                <span>{m.generations.map((g) => g.label).join(" · ")}</span>
              </button>
            ))}
          </div>
          {notFound}
        </>
      )}

      {view === "generation" && model && (
        <>
          <h2 className="wz-title">Quelle année ?</h2>
          <div className="pk-list">
            {model.generations.map((g) => (
              <button key={g.id} className="pk-row" onClick={() => { setGen(g); setHit(null); setView("preview"); }}>
                <strong>
                  {g.years} <em>{g.label}</em>
                </strong>
                {g.hint && <span>{g.hint}</span>}
              </button>
            ))}
          </div>
          {notFound}
        </>
      )}

      {view === "preview" && (
        <>
          {/* Le client voit notre rendu (voiture du garage) ou une fiche propre : jamais le modèle Sketchfab d'un inconnu.
              Le modèle choisi (uid) part quand même avec la demande, il sert de base de travail. */}
          {garageCar ? (
            <div className="pk-stage">
              <ShelfPreview car={garageCar} />
            </div>
          ) : (
            <div className="pk-card">
              {brand && <BrandMark id={brand.id} mark={brand.mark} />}
              <div>
                <span>Ta voiture</span>
                {gen?.hint && <p>{gen.hint}</p>}
              </div>
            </div>
          )}
          <h2 className="wz-title">{label}</h2>
          <p className="wz-tip">
            On part de ce modèle, puis on reproduit ta voiture d'après tes photos : couleur, jantes, modifs et détails.
          </p>
          <button className="cta full" onClick={confirm}>
            C'est ma voiture, je passe aux photos
          </button>
          {notFound}
        </>
      )}

      {view === "search" && (
        <>
          <h2 className="wz-title">Recherche libre</h2>
          <p className="wz-tip">Tape la marque, le modèle et l'année. Choisis le modèle qui ressemble le plus à ta voiture.</p>
          <div className="pk-search">
            <CarSearch
              key={brand?.id ?? "libre"}
              initial={brand ? `${brand.name} ` : ""}
              onPick={(h) => { setHit(h); setGen(null); setView("preview"); }}
            />
          </div>
          <button className="link pk-miss" onClick={() => setView("manual")}>
            Rien ne ressemble à ma voiture
          </button>
        </>
      )}

      {view === "manual" && (
        <>
          <h2 className="wz-title">Dis-nous juste ce que c'est</h2>
          <p className="wz-tip">On partira de tes photos.</p>
          <div className="up-fields">
            <input placeholder="Marque, modèle, année (ex. Golf 8 GTI 2021)" value={manual} onChange={(e) => setManual(e.target.value)} />
          </div>
          <button
            className="cta full"
            disabled={manual.trim().length < 2}
            onClick={() => onPick({ label: manual.trim(), brand: brand?.name, source: "aucune" })}
          >
            Passer aux photos
          </button>
        </>
      )}

      {back[view] && (
        <div className="wz-nav">
          <button className="link" onClick={() => setView(back[view]!)}>
            ← Retour
          </button>
        </div>
      )}
    </div>
  );
}
