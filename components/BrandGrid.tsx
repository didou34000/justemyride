"use client";

import { brands } from "@/lib/catalog";
import { BrandMark } from "./CarPicker";

/** Accueil : le client clique sa marque, la page descend jusqu'au formulaire avec la marque déjà choisie. */
export default function BrandGrid() {
  function go(id: string) {
    window.dispatchEvent(new CustomEvent("jmr:brand", { detail: id }));
    document.getElementById("deposer")?.scrollIntoView({ behavior: "smooth" });
  }
  return (
    <section className="home-block" id="marques">
      <p className="eyebrow">Étape 1</p>
      <h2>
        Quelle est <i>ta</i> marque ?
      </h2>
      <p className="block-sub">Choisis-la, puis le modèle et l'année. Elle n'y est pas ? Envoie simplement tes photos.</p>
      <div className="brand-grid">
        {brands.map((b) => (
          <button key={b.id} className="brand-tile" onClick={() => go(b.id)}>
            <BrandMark id={b.id} mark={b.mark} />
            <span>{b.name}</span>
          </button>
        ))}
      </div>
      <p className="brand-other">
        Ta marque n'y est pas ?{" "}
        <button onClick={() => document.getElementById("deposer")?.scrollIntoView({ behavior: "smooth" })}>Envoie tes photos, on s'adapte.</button>
      </p>
      <p className="brand-note">
        Logos affichés uniquement pour t'aider à reconnaître ta marque. JustMyRide n'a aucun lien avec les constructeurs.
      </p>
    </section>
  );
}
