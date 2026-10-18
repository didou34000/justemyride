"use client";

import { useState } from "react";
import { brands } from "@/lib/catalog";
import { BrandMark } from "./CarPicker";

/** Accueil : le client clique sa marque, la page descend jusqu'au formulaire avec la marque déjà choisie. */
export default function BrandGrid() {
  const [all, setAll] = useState(false);
  function go(id: string) {
    window.dispatchEvent(new CustomEvent("jmr:brand", { detail: id }));
    document.getElementById("deposer")?.scrollIntoView({ behavior: "smooth" });
  }
  return (
    <section className="home-block" id="marques">
      <h2>
        Quelle est <i>ta</i> marque ?
      </h2>
      <div className="brand-grid">
        {(all ? brands : brands.slice(0, 21)).map((b) => (
          <button key={b.id} className="brand-tile" onClick={() => go(b.id)}>
            <BrandMark id={b.id} mark={b.mark} />
            <span>{b.name}</span>
          </button>
        ))}
      </div>
      {!all && (
        <button className="cta ghost brand-more" onClick={() => setAll(true)}>
          Voir les {brands.length} marques
        </button>
      )}
      <p className="brand-other">
        Ta marque n'y est pas ?{" "}
        <button onClick={() => document.getElementById("deposer")?.scrollIntoView({ behavior: "smooth" })}>Envoie tes photos, on s'adapte.</button>
      </p>
    </section>
  );
}
