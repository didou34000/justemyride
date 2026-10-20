import { put } from "@vercel/blob";
import { after, NextResponse } from "next/server";
import { BLOB_ACCESS, storageEnabled } from "@/lib/storage";
import { notifyAnalysis, notifyNewRequest } from "@/lib/notify";
import { analyse, analyseConfigured } from "@/lib/analyse";
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

// Laisse le temps à l'analyse des photos, lancée après la réponse au client.
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

  // Le point automatique (Claude compare les photos à la base) : après la réponse, le client n'attend pas.
  if (analyseConfigured()) {
    after(async () => {
      try {
        const rec = await analyse(s.id);
        await notifyAnalysis(s.id, s.car || s.base?.label || "Voiture", rec);
      } catch (e) {
        console.error("Analyse non faite :", (e as Error).message);
      }
    });
  }

  return NextResponse.json({ id: s.id, alert });
}
