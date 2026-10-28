import { NextResponse } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/authShared";

export const dynamic = "force-dynamic";

// Projet Supabase « justmyride ». L'adresse et la clé publique ne sont pas secrètes (le navigateur les reçoit),
// elles servent ici même quand la connexion client n'est pas encore allumée dans Vercel.
const URL = SUPABASE_URL || "https://nhxrzfjnqjjxpeclirao.supabase.co";
const KEY = SUPABASE_ANON_KEY || "sb_publishable_4WNjb_oefU4wfGexD4vE3A_wGxOtPpx";

/**
 * Lancé chaque jour par Vercel (vercel.json → crons). Supabase met en pause un projet gratuit après 7 jours sans activité :
 * une vraie lecture dans la base (table keepalive, une ligne) suffit à le garder éveillé.
 * Vercel envoie « Authorization: Bearer <CRON_SECRET> » ; sans ce secret, n'importe qui ne peut que lire cette ligne.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  }
  const res = await fetch(`${URL}/rest/v1/keepalive?select=id&limit=1`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    cache: "no-store",
  }).catch((e: Error) => ({ ok: false, status: 0, statusText: e.message }) as const);
  if (!res.ok) {
    console.error(`Réveil Supabase raté : ${res.status} ${res.statusText}`);
    return NextResponse.json({ ok: false, status: res.status }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
