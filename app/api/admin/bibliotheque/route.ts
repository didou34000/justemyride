import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { addUploaded, listElements, removeElement, updateElement } from "@/lib/bibliotheque";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** La liste des pièces de la bibliothèque. */
export async function GET(request: Request) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  return NextResponse.json({ elements: await listElements() });
}

/**
 * Body : { action, … }
 * "ajouter" { pathname, nom, sorte, voitures } : range un .glb déposé (allégé au passage) ;
 * "modifier" { element, nom?, sorte?, voitures?, attention? } ; "retirer" { element }.
 */
export async function POST(request: Request) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const { action, element } = body;
  try {
    if (action === "ajouter" && typeof body.pathname === "string") await addUploaded(body.pathname, body);
    else if (action === "modifier" && typeof element === "string") await updateElement(element, body);
    else if (action === "retirer" && typeof element === "string") await removeElement(element);
    else return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
    return NextResponse.json({ elements: await listElements() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
