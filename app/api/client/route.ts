import { NextResponse } from "next/server";
import { authConfigured, clientKey, clientStatus, readClient, userFromRequest } from "@/lib/clients";

export const dynamic = "force-dynamic";

/** Le client connecté : a-t-il encore son aperçu gratuit, ou des aperçus payés à utiliser ? */
export async function GET(request: Request) {
  if (!authConfigured()) return NextResponse.json({ auth: false });
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const c = await readClient(clientKey(user.email), user.email);
  return NextResponse.json({ auth: true, ...clientStatus(c, user.email) });
}
