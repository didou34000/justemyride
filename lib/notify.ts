/**
 * E-mail d'alerte quand un client envoie ses photos, via l'API Resend (côté serveur uniquement).
 * Sans RESEND_API_KEY ou NOTIFY_EMAIL, rien n'est envoyé : la demande reste enregistrée dans le stockage.
 */

// Domaine déjà vérifié sur le compte Resend ; à remplacer par justmyride.shop une fois le domaine acheté et vérifié.
const FROM = process.env.RESEND_FROM || "JustMyRide <alertes@iksee.fr>";
const FALLBACK_FROM = "JustMyRide <onboarding@resend.dev>";

export type NewRequest = {
  id: string;
  email: string;
  car: string;
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
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#161514;line-height:1.5">
      <h2 style="margin:0 0 12px">Nouvelle demande : ${esc(car)}</h2>
      <p style="margin:0 0 16px">
        Client : <a href="mailto:${esc(r.email)}">${esc(r.email)}</a><br>
        Photos : ${angles} angles${details ? ` + ${details} détail${details > 1 ? "s" : ""}` : ""}<br>
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

  const send = (from: string) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: r.email,
        subject: `Nouvelle demande : ${car} (${r.files.length} photos)`,
        html,
      }),
    });

  let res = await send(FROM);
  // Domaine de l'expéditeur non vérifié sur ce compte Resend : on retente avec l'expéditeur de test de Resend,
  // qui n'écrit qu'à l'adresse du compte (NOTIFY_EMAIL doit donc être l'e-mail du compte Resend).
  if (!res.ok && (res.status === 403 || res.status === 422)) res = await send(FALLBACK_FROM);
  if (!res.ok) throw new Error(`Resend ${res.status} : ${await res.text()}`);
  return "sent";
}
