import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminLoginEnabled, newSession, passwordOk } from "@/lib/adminAuth";

/** Connexion admin : { password } → cookie de session. DELETE : déconnexion. */
export async function POST(request: Request) {
  if (!adminLoginEnabled()) return NextResponse.json({ error: "Accès admin non configuré" }, { status: 503 });
  const { password } = await request.json().catch(() => ({}));
  if (!passwordOk(password)) {
    // Ralentit les essais au hasard.
    await new Promise((r) => setTimeout(r, 1200));
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }
  const s = newSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, s.value, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: s.maxAge });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
