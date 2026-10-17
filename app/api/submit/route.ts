import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { BLOB_ACCESS, storageEnabled } from "@/lib/storage";
import { notifyNewRequest } from "@/lib/notify";
import type { Base } from "@/lib/catalog";

type Submission = {
  id: string;
  email: string;
  car: string;
  base?: Base | null;
  mode: "photos";
  files: { slot: string; url: string; pathname: string }[];
};

/** Enregistre la demande (contact + liste des fichiers) à côté des fichiers envoyés. */
export async function POST(request: Request) {
  if (!storageEnabled()) {
    return NextResponse.json({ error: "Stockage non configuré" }, { status: 503 });
  }

  const s = (await request.json()) as Submission;
  if (!/^[\w-]{6,40}$/.test(s.id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(s.email)) return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  if (!s.files?.length) return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });

  await put(
    `submissions/${s.id}/demande.json`,
    JSON.stringify({ ...s, receivedAt: new Date().toISOString() }, null, 2),
    { access: BLOB_ACCESS, contentType: "application/json", addRandomSuffix: false }
  );

  // L'alerte ne doit jamais faire échouer l'envoi : la demande est déjà enregistrée.
  let alert: string;
  try {
    alert = await notifyNewRequest(s);
  } catch (e) {
    const msg = (e as Error).message;
    console.error("Alerte e-mail non envoyée :", msg);
    alert = `failed (${msg.match(/^Resend \d+ [\w-]*/)?.[0] ?? "erreur"})`;
  }

  return NextResponse.json({ id: s.id, alert });
}
