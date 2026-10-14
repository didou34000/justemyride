import { NextResponse } from "next/server";
import type { Config } from "@/lib/options";
import { createCheckout, shopifyConfigured } from "@/lib/shopify";

export async function POST(req: Request) {
  const config = (await req.json()) as Config;

  if (!shopifyConfigured()) {
    return NextResponse.json({ demo: true });
  }

  try {
    const checkoutUrl = await createCheckout(config);
    return NextResponse.json({ checkoutUrl });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
