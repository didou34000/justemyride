import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { isFichierKind, setFichier } from "@/lib/fichiers";

/** Enregistre un fichier que le propriétaire vient de déposer. Body : { id, kind, pathname }. */
export async function POST(request: Request) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const { id, kind, pathname } = await request.json().catch(() => ({}));
  if (typeof id !== "string" || !/^[\w-]{6,40}$/.test(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  if (!isFichierKind(kind) || typeof pathname !== "string") return NextResponse.json({ error: "Fichier invalide" }, { status: 400 });
  try {
    return NextResponse.json({ fichiers: await setFichier(id, kind, pathname) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
