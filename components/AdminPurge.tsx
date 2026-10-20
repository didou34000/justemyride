"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = { id: string; car: string; email: string; date: string };

/** Efface toutes les demandes (tests) après avoir montré la liste exacte de ce qui part. */
export default function AdminPurge({ orders }: { orders: Item[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function purge() {
    setBusy(true);
    const res = await fetch("/api/admin/supprimer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? `${d.deleted} fichier(s) effacé(s).` : (d.error ?? `Erreur ${res.status}`));
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="admin-purge">
      {!open ? (
        <button className="link" onClick={() => setOpen(true)}>
          Effacer toutes les demandes…
        </button>
      ) : (
        <div className="notice err">
          <p>
            <b>Ces {orders.length} demande(s) seront effacées pour de bon</b>, avec leurs photos, modèles 3D et rapports. Les compteurs de plafonds restent.
          </p>
          <ul className="admin-list">
            {orders.map((o) => (
              <li key={o.id}>
                {o.car} · {o.email} · {o.date ? new Date(o.date).toLocaleDateString("fr-FR") : "?"} <code>{o.id}</code>
              </li>
            ))}
          </ul>
          <div className="admin-actions">
            <button className="cta" disabled={busy} onClick={purge}>
              {busy ? "Effacement…" : "Oui, tout effacer"}
            </button>
            <button className="link" disabled={busy} onClick={() => setOpen(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}
      {msg && <p className="sub">{msg}</p>}
    </div>
  );
}
