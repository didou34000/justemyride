import { NextResponse } from "next/server";
import { getFile } from "@/lib/store";
import { isAdmin } from "@/lib/adminAuth";

/** Affiche une photo privée d'une demande (ou un fichier de la bibliothèque), pour le propriétaire seulement. ?p=submissions/<id>/<fichier> */
export async function GET(request: Request) {
  if (!isAdmin(request)) return new NextResponse("Accès refusé", { status: 401 });
  const p = new URL(request.url).searchParams.get("p") ?? "";
  if (!/^(submissions\/[\w-]+|bibliotheque)\/[\w.-]+$/.test(p)) return new NextResponse("Chemin invalide", { status: 400 });
  const r = await getFile(p);
  if (!r) return new NextResponse("Introuvable", { status: 404 });
  return new NextResponse(r.stream, {
    headers: { "Content-Type": r.contentType, "Cache-Control": "private, max-age=3600" },
  });
}
