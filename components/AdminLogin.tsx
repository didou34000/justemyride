"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Erreur");
    router.refresh();
  }

  return (
    <section className="admin admin-login">
      <p className="eyebrow">Espace admin</p>
      <h2>Connexion</h2>
      <form className="up-fields" onSubmit={submit}>
        <input type="password" inputMode="numeric" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        <button className="cta" disabled={busy || !password}>{busy ? "…" : "Entrer"}</button>
      </form>
      {error && <p className="notice err">{error}</p>}
    </section>
  );
}
