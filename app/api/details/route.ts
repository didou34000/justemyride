import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { checkDetails, detailsConfigured } from "@/lib/details";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Contrôle des détails après Meshy. Body : { id, views: [data URL jpeg] } (vues rendues par le navigateur). */
export async function POST(request: Request) {
  if (!detailsConfigured()) return NextResponse.json({ error: "Contrôle désactivé (clé Claude manquante)" }, { status: 503 });
  if (!isAdmin(request)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const { id, views } = await request.json().catch(() => ({}));
  if (typeof id !== "string" || !/^[\w-]{6,40}$/.test(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  if (!Array.isArray(views) || !views.every((v) => typeof v === "string" && v.length < 1_500_000))
    return NextResponse.json({ error: "Vues invalides" }, { status: 400 });
  try {
    return NextResponse.json({ details: await checkDetails(id, views) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
