import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { MANUAL, setManualStep, type ManualStep } from "@/lib/orders";

/** Coche ou décoche une étape faite à la main. Body : { id, step, done }. */
export async function POST(request: Request) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const { id, step, done } = await request.json().catch(() => ({}));
  if (typeof id !== "string" || !/^[\w-]{6,40}$/.test(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  if (!MANUAL.includes(step)) return NextResponse.json({ error: "Étape inconnue" }, { status: 400 });
  return NextResponse.json({ suivi: await setManualStep(id, step as ManualStep, done === true) });
}
