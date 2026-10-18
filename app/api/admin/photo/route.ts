import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { isAdmin } from "@/lib/adminAuth";
import { BLOB_ACCESS } from "@/lib/storage";

/** Affiche une photo privée d'une demande, pour le propriétaire seulement. ?p=submissions/<id>/<fichier> */
export async function GET(request: Request) {
  if (!isAdmin(request)) return new NextResponse("Accès refusé", { status: 401 });
  const p = new URL(request.url).searchParams.get("p") ?? "";
  if (!/^submissions\/[\w-]+\/[\w.-]+$/.test(p)) return new NextResponse("Chemin invalide", { status: 400 });
  const r = await get(p, { access: BLOB_ACCESS }).catch(() => null);
  if (!r || r.statusCode !== 200) return new NextResponse("Introuvable", { status: 404 });
  return new NextResponse(r.stream, {
    headers: { "Content-Type": r.headers.get("content-type") || "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
}
