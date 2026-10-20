import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { fetchBase } from "@/lib/base";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** (Re)télécharge le modèle de base d'une commande. Body : { id, uid? } (uid = un autre modèle Sketchfab). */
export async function POST(request: Request) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const { id, uid } = await request.json().catch(() => ({}));
  if (typeof id !== "string" || !/^[\w-]{6,40}$/.test(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  // On accepte l'adresse entière d'un modèle Sketchfab : l'uid est la fin (32 caractères hexadécimaux).
  const u = typeof uid === "string" ? uid.match(/([0-9a-f]{32})\/?(?:[?#].*)?$/i)?.[1] : undefined;
  if (uid && !u) return NextResponse.json({ error: "Adresse Sketchfab non reconnue" }, { status: 400 });
  try {
    return NextResponse.json({ base: await fetchBase(id, u) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
