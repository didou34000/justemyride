import { NextResponse } from "next/server";
import { AuthDown, authConfigured, clientKey, clientStatus, readClient, userFromRequest } from "@/lib/clients";

export const dynamic = "force-dynamic";

/** Le client connecté : a-t-il encore son aperçu gratuit, ou des aperçus payés à utiliser ? */
export async function GET(request: Request) {
  if (!authConfigured()) return NextResponse.json({ auth: false });
  const user = await userFromRequest(request).catch((e) => (e instanceof AuthDown ? e : Promise.reject(e)));
  if (user instanceof AuthDown) return NextResponse.json({ error: user.message, down: true }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const c = await readClient(clientKey(user.email), user.email);
  return NextResponse.json({ auth: true, ...clientStatus(c, user.email) });
}
