"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Recharge les données de la page toutes les `every` secondes tant que l'onglet est visible.
 * `poll` : adresse à appeler avant (ex. demander à Meshy où en est la génération).
 */
export default function LiveRefresh({ every = 30, poll }: { every?: number; poll?: string }) {
  const router = useRouter();
  const [at, setAt] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      if (poll) await fetch(poll).catch(() => null);
      router.refresh();
      setAt(new Date());
    }, every * 1000);
    return () => clearInterval(t);
  }, [every, poll, router]);

  return (
    <span className="live" title={`Mise à jour toutes les ${every} s`}>
      <i /> En direct · {at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}
