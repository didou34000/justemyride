import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { refreshPieces, startPieces } from "@/lib/meshy";

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

/** Lance les pièces choisies. Body : { id, pieces: [0, 1…] } (rangs du 3e rapport). Payant. */
export async function POST(request: Request) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const { id, pieces } = await request.json().catch(() => ({}));
  if (!validId(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  if (!Array.isArray(pieces) || !pieces.every((i) => Number.isInteger(i))) return NextResponse.json({ error: "Pièces invalides" }, { status: 400 });
  try {
    return NextResponse.json(await startPieces(id, pieces));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
