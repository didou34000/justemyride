/**
 * E-mail d'alerte quand un client envoie ses photos, via l'API Resend (côté serveur uniquement).
 * Sans RESEND_API_KEY ou NOTIFY_EMAIL, rien n'est envoyé : la demande reste enregistrée dans le stockage.
 */

import { plaqueResume, type Plaque } from "@/lib/plaques";

// Domaine déjà vérifié sur le compte Resend ; à remplacer par justmyride.shop une fois le domaine acheté et vérifié.
const FROM = process.env.RESEND_FROM || "JustMyRide <alertes@iksee.fr>";
const FALLBACK_FROM = "JustMyRide <onboarding@resend.dev>";

export type NewRequest = {
  id: string;
  email: string;
  car: string;
  base?: { label: string; uid?: string; car?: string; source: string } | null;
  plaque?: Plaque;
  files: { slot: string; pathname: string }[];
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function alertsConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL);
}

/** Renvoie "sent", ou "off" si les variables manquent. Lève une erreur si Resend refuse. */
export async function notifyNewRequest(r: NewRequest): Promise<"sent" | "off"> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  if (!key || !to) return "off";

  const car = r.car.trim() || "Voiture non précisée";
  const angles = r.files.filter((f) => !f.slot.startsWith("detail-")).length;
  const details = r.files.length - angles;
  const uid = r.base?.uid && /^[\w-]{10,40}$/.test(r.base.uid) ? r.base.uid : "";
  const base = !r.base
    ? "non choisie"
    : uid
      ? `<a href="https://sketchfab.com/3d-models/${uid}">${esc(r.base.label)}</a> (${r.base.source === "recherche" ? "recherche libre" : "annuaire"})`
      : r.base.car
        ? `${esc(r.base.label)} (garage : ${esc(r.base.car)})`
        : `${esc(r.base.label)} (aucun modèle 3D, à partir des photos)`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#161514;line-height:1.5">
      <h2 style="margin:0 0 12px">Nouvelle demande : ${esc(car)}</h2>
      <p style="margin:0 0 16px">
        Client : <a href="mailto:${esc(r.email)}">${esc(r.email)}</a><br>
        Base 3D : ${base}<br>
        ${r.plaque ? `Plaque : ${esc(plaqueResume(r.plaque))}<br>` : ""}
        Photos : ${angles} vue${angles > 1 ? "s" : ""}${details ? ` + ${details} détail${details > 1 ? "s" : ""}` : ""}<br>
        Dossier : <code>submissions/${esc(r.id)}/</code>
      </p>
      <p style="margin:0 0 8px">Fichiers reçus :</p>
      <ul style="margin:0 0 16px;padding-left:18px">
        ${r.files.map((f) => `<li>${esc(f.slot)} : <code>${esc(f.pathname)}</code></li>`).join("")}
      </ul>
      <p style="margin:0;color:#7a756d;font-size:13px">
        Les photos sont dans Vercel → Storage → le store Blob → dossier submissions.
        Réponds directement à cet e-mail pour écrire au client.
      </p>
    </div>`;

  await sendMail({ to, key, replyTo: r.email, subject: `Nouvelle demande : ${car} (${r.files.length} photos)`, html });
  return "sent";
}

async function sendMail(m: { to: string; key: string; replyTo?: string; subject: string; html: string }) {
  const send = (from: string) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${m.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [m.to], reply_to: m.replyTo, subject: m.subject, html: m.html }),
    });

  let res = await send(FROM);
  // Domaine de l'expéditeur non vérifié sur ce compte Resend : on retente avec l'expéditeur de test de Resend,
  // qui n'écrit qu'à l'adresse du compte (NOTIFY_EMAIL doit donc être l'e-mail du compte Resend).
  if (!res.ok && (res.status === 403 || res.status === 422)) res = await send(FALLBACK_FROM);
  if (!res.ok) {
    const body = await res.text();
    const name = (() => {
      try {
        return (JSON.parse(body) as { name?: string }).name ?? "";
      } catch {
        return "";
      }
    })();
    throw new Error(`Resend ${res.status} ${name} : ${body}`);
  }
}
