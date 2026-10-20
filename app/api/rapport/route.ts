import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { claudeConfigured, validImages } from "@/lib/claude";
import { readJson } from "@/lib/blobJson";
import { readFichiers } from "@/lib/fichiers";
import { couleurs, glbLoader, rapport1, rapport2, type CouleursRec } from "@/lib/rapports";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Les passages de Claude sur une commande, avec les images rendues par le navigateur de l'admin.
 * Body : { id, step: "rapport1", views } | { id, step: "couleurs", sheets: [{ id: "m3", image }] } | { id, step: "rapport2", views }.
 */
export async function POST(request: Request) {
  if (!claudeConfigured()) return NextResponse.json({ error: "Claude désactivé (clé ANTHROPIC_API_KEY manquante)" }, { status: 503 });
  if (!isAdmin(request)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const { id, step, views, sheets } = await request.json().catch(() => ({}));
  if (typeof id !== "string" || !/^[\w-]{6,40}$/.test(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  try {
    if (step === "rapport1") {
      if (!validImages(views, 6)) return NextResponse.json({ error: "Vues invalides" }, { status: 400 });
      return NextResponse.json({ rec: await rapport1(id, views) });
    }
    if (step === "couleurs") {
      const ok =
        Array.isArray(sheets) &&
        sheets.length <= 48 &&
        sheets.every((s) => typeof s?.id === "string" && /^m\d+$/.test(s.id)) &&
        (!sheets.length || validImages(sheets.map((s) => s.image), 48));
      if (!ok) return NextResponse.json({ error: "Images des matériaux invalides" }, { status: 400 });
      const load = glbLoader(new URL(request.url).origin, request.headers.get("cookie"));
      return NextResponse.json({ rec: await couleurs(id, sheets, load) });
    }
    if (step === "rapport2") {
      if (!validImages(views, 6)) return NextResponse.json({ error: "Vues invalides" }, { status: 400 });
      const glb = (await readFichiers(id)).couleurs ?? (await readJson<CouleursRec>(`submissions/${id}/couleurs.json`))?.glb;
      if (!glb) return NextResponse.json({ error: "Pas encore de voiture repeinte" }, { status: 409 });
      return NextResponse.json({ rec: await rapport2(id, views, glb) });
    }
    return NextResponse.json({ error: "Étape inconnue" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
