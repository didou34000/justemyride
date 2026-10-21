import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { choosePiece, refreshPieces, startPiece } from "@/lib/meshy";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const validId = (id: unknown): id is string => typeof id === "string" && /^[\w-]{6,40}$/.test(id);

/** ?id=… : met à jour les pièces Meshy en cours. */
export async function GET(request: Request) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!validId(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  return NextResponse.json(await refreshPieces(id));
}

/**
 * Body : { id, piece, action, prompt?, prompts?, model?, job? } (piece = rang dans le 3e rapport ; prompts = un par image ; model = modèle d'image).
 * action "image" : dessin de la pièce seule (payant) ; "3d" : 3D d'après le dessin retenu (payant) ;
 * "choisir-image" / "choisir-3d" : retient le résultat n° job.
 */
export async function POST(request: Request) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const { id, piece, action, prompt, prompts, job, model } = await request.json().catch(() => ({}));
  if (!validId(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  if (!Number.isInteger(piece) || piece < 0) return NextResponse.json({ error: "Pièce invalide" }, { status: 400 });
  try {
    if (action === "image" || action === "3d")
      return NextResponse.json(
        await startPiece(
          id,
          piece,
          action,
          typeof prompt === "string" ? prompt : undefined,
          model,
          Array.isArray(prompts) && prompts.every((p) => typeof p === "string") ? prompts : undefined,
        ),
      );
    if ((action === "choisir-image" || action === "choisir-3d") && Number.isInteger(job))
      return NextResponse.json(await choosePiece(id, piece, action === "choisir-image" ? "image" : "3d", job));
    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
