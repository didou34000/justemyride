import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { deleteOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Efface une demande ({ id }) ou toutes ({ all: true }), photos et rapports compris. Irréversible. */
export async function POST(request: Request) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const { id, all } = await request.json().catch(() => ({}));
  if (all === true) return NextResponse.json({ deleted: await deleteOrders() });
  if (typeof id !== "string" || !/^[\w-]{6,40}$/.test(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  return NextResponse.json({ deleted: await deleteOrders(id) });
}
