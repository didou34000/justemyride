import { NextResponse } from "next/server";
import { clientKey, userFromRequest } from "@/lib/clients";
import { createApercuCheckout, shopifyConfigured } from "@/lib/shopify";

/** Paiement d'un aperçu supplémentaire (5 €) : renvoie l'adresse du paiement Shopify. */
export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: "Connecte-toi d'abord" }, { status: 401 });
  if (!shopifyConfigured()) return NextResponse.json({ error: "Paiement pas encore branché" }, { status: 503 });
  try {
    return NextResponse.json({ checkoutUrl: await createApercuCheckout(user.email, clientKey(user.email)) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
