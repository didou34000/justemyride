"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Mobile : le bouton reste en bas de l'écran une fois le premier écran passé. */
export default function StickyCta({ from }: { from: number }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const onScroll = () => setHidden(window.scrollY < 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className={`sticky-cta ${hidden ? "off" : ""}`} aria-hidden={hidden}>
      <span>
        Dès <b>{from} €</b>
      </span>
      <Link href="/envoyer" className="cta" tabIndex={hidden ? -1 : 0}>
        Envoyer mes photos
      </Link>
    </div>
  );
}
