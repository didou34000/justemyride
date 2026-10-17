import { NextResponse } from "next/server";
import { isAdmin, meshyConfigured, refreshJob, startJob, usage } from "@/lib/meshy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const validId = (id: unknown): id is string => typeof id === "string" && /^[\w-]{6,40}$/.test(id);

function guard(request: Request) {
  if (!meshyConfigured()) return NextResponse.json({ error: "Génération 3D désactivée" }, { status: 503 });
  if (!isAdmin(request)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  return null;
}

/** Réservé au propriétaire : lance la génération 3D d'une demande client. Body : { id }. */
export async function POST(request: Request) {
  const refused = guard(request);
  if (refused) return refused;
  const { id } = await request.json().catch(() => ({}));
  if (!validId(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  try {
    return NextResponse.json({ job: await startJob(id), usage: await usage() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}

/** ?id=… : état de la génération (et copie du GLB une fois prête). Sans id : compteur du mois. */
export async function GET(request: Request) {
  const refused = guard(request);
  if (refused) return refused;
  const id = new URL(request.url).searchParams.get("id");
  const u = await usage();
  const { raw: _raw, ...counts } = u;
  if (!id) return NextResponse.json({ usage: counts });
  if (!validId(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  try {
    return NextResponse.json({ job: await refreshJob(id), usage: counts });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
