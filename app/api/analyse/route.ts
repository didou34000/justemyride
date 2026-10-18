import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/meshy";
import { analyse, analyseConfigured, analyseUsage, readAnalysis } from "@/lib/analyse";
import { readJson } from "@/lib/blobJson";
import { notifyAnalysis } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const validId = (id: unknown): id is string => typeof id === "string" && /^[\w-]{6,40}$/.test(id);

function guard(request: Request) {
  if (!analyseConfigured()) return NextResponse.json({ error: "Analyse désactivée" }, { status: 503 });
  if (!isAdmin(request)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  return null;
}

/** ?id=… : la demande et son point. Sans id : le compteur du mois. */
export async function GET(request: Request) {
  const refused = guard(request);
  if (refused) return refused;
  const id = new URL(request.url).searchParams.get("id");
  const { raw: _raw, ...usage } = await analyseUsage();
  if (!id) return NextResponse.json({ usage });
  if (!validId(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  const demande = await readJson<Record<string, unknown>>(`submissions/${id}/demande.json`);
  if (!demande) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  return NextResponse.json({ demande, analyse: await readAnalysis(id), usage });
}

/** Relance l'analyse (après une erreur, ou { force: true } pour la refaire). Body : { id, force? }. */
export async function POST(request: Request) {
  const refused = guard(request);
  if (refused) return refused;
  const { id, force } = await request.json().catch(() => ({}));
  if (!validId(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  try {
    const rec = await analyse(id, { force: force === true });
    const demande = await readJson<{ car?: string }>(`submissions/${id}/demande.json`);
    await notifyAnalysis(id, demande?.car || "Voiture", rec).catch(() => "off");
    return NextResponse.json({ analyse: rec });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
