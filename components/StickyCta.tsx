"use client";

import { useEffect, useState } from "react";

/** Mobile : le bouton reste en bas de l'écran, et s'efface quand le formulaire d'envoi est visible. */
export default function StickyCta({ from }: { from: number }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const target = document.getElementById("deposer");
    const onScroll = () => {
      const r = target?.getBoundingClientRect();
      const nearForm = r ? r.top < window.innerHeight && r.bottom > 0 : false;
      setHidden(window.scrollY < 300 || nearForm);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className={`sticky-cta ${hidden ? "off" : ""}`} aria-hidden={hidden}>
      <span>
        Dès <b>{from} €</b>
      </span>
      <a href="#deposer" className="cta" tabIndex={hidden ? -1 : 0}>
        Commencer ma miniature
      </a>
    </div>
  );
}
