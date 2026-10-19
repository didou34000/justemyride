"use client";

import { useEffect } from "react";

/** Les blocs marqués data-reveal apparaissent en douceur quand ils arrivent à l'écran. Sans JavaScript, tout reste visible. */
export default function Reveal() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    for (const el of els) {
      if (el.getBoundingClientRect().top > window.innerHeight) {
        el.classList.add("pre");
        io.observe(el);
      }
    }
    return () => io.disconnect();
  }, []);
  return null;
}
