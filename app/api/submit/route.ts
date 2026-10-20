import { put } from "@vercel/blob";
import { after, NextResponse } from "next/server";
import { BLOB_ACCESS, storageEnabled } from "@/lib/storage";
import { notifyNewRequest } from "@/lib/notify";
import { fetchBase } from "@/lib/base";
import type { Base } from "@/lib/catalog";

type Submission = {
  id: string;
  email: string;
  car: string;
  base?: Base | null;
  /** Taille souhaitée sur la fiche produit (1-43, 1-24, 1-18), indicative. */
  size?: string;
  mode: "photos";
  files: { slot: string; url: string; pathname: string }[];
};

// Laisse le temps de télécharger le modèle Sketchfab, après la réponse au client.
export const maxDuration = 300;

/** Enregistre la demande (contact + liste des fichiers) à côté des fichiers envoyés. */
export async function POST(request: Request) {
  if (!storageEnabled()) {
    return NextResponse.json({ error: "Stockage non configuré" }, { status: 503 });
  }

  const s = (await request.json()) as Submission;
  if (!/^[\w-]{6,40}$/.test(s.id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(s.email)) return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  if (!s.files?.length) return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
  if (s.size !== undefined && !/^1-(43|24|18)$/.test(s.size)) delete s.size;

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
    console.error("Alerte e-mail non envoyée :", (e as Error).message);
    alert = "failed";
  }

  // Le modèle de base est téléchargé dans la commande tout de suite : le client n'attend pas.
  after(async () => {
    try {
      await fetchBase(s.id);
    } catch (e) {
      console.error("Modèle de base non téléchargé :", (e as Error).message);
    }
  });

  return NextResponse.json({ id: s.id, alert });
}
