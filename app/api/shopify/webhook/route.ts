import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { readClient, saveClient } from "@/lib/clients";
import { APERCU_VARIANT } from "@/lib/shopify";

type LineItem = { variant_id: number | null; quantity: number; properties?: { name: string; value: string }[] };

/**
 * Webhook Shopify « Paiement de commande » (orders/paid), réglé dans Shopify → Paramètres → Notifications → Webhooks.
 * Chaque aperçu supplémentaire payé ajoute un crédit au client dont l'empreinte est sur la ligne (_client).
 * Signé avec SHOPIFY_WEBHOOK_SECRET (la clé affichée sous la liste des webhooks dans Shopify).
 */
export async function POST(request: Request) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 });
  const raw = await request.text();
  const sent = Buffer.from(request.headers.get("x-shopify-hmac-sha256") ?? "", "base64");
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest();
  if (sent.length !== expected.length || !timingSafeEqual(sent, expected)) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  const order = JSON.parse(raw) as { id: number; line_items?: LineItem[] };
  const variant = APERCU_VARIANT.split("/").pop();
  for (const li of order.line_items ?? []) {
    if (String(li.variant_id) !== variant) continue;
    const key = li.properties?.find((p) => p.name === "_client")?.value;
    if (!key || !/^[0-9a-f]{32}$/.test(key)) continue;
    const c = await readClient(key);
    if (c.paiements.some((p) => p.order === String(order.id))) continue;
    c.credits += li.quantity;
    c.paiements.push({ order: String(order.id), at: new Date().toISOString() });
    await saveClient(key, c);
  }
  return NextResponse.json({ ok: true });
}
