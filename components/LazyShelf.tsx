"use client";

import { useEffect, useRef, useState } from "react";
import ShelfPreview from "./ShelfPreview";
import type { Car } from "@/lib/cars";
import type { Config } from "@/lib/options";

/** La miniature 3D ne se charge que quand elle arrive à l'écran : l'accueil reste léger. */
export default function LazyShelf({ car, tweak }: { car: Car; tweak?: Partial<Config> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="lazy-shelf">
      {seen ? <ShelfPreview car={car} tweak={tweak} /> : <div className="viewer"><div className="viewer-loading">Aperçu 3D</div></div>}
    </div>
  );
}
