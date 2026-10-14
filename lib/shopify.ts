import type { Config } from "./options";

const API_VERSION = "2025-07";

const sizeVariant: Record<string, string | undefined> = {
  "1-43": process.env.SHOPIFY_VARIANT_SCALE_43,
  "1-24": process.env.SHOPIFY_VARIANT_SCALE_24,
  "1-18": process.env.SHOPIFY_VARIANT_SCALE_18,
};

const extraVariant: Record<string, string | undefined> = {
  gt: process.env.SHOPIFY_VARIANT_SPOILER_GT,
  socle: process.env.SHOPIFY_VARIANT_BASE,
  vitrine: process.env.SHOPIFY_VARIANT_CASE,
};

export function shopifyConfigured() {
  return Boolean(
    process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_TOKEN
  );
}

/** Crée un panier Shopify et renvoie l'URL de paiement hébergée par Shopify. */
export async function createCheckout(c: Config): Promise<string> {
  const main = sizeVariant[c.size];
  if (!main) throw new Error(`Variante Shopify manquante pour la taille ${c.size}`);

  // La configuration voyage avec la ligne principale : elle apparaît dans la commande.
  const attributes = [
    { key: "Voiture", value: `${c.make} ${c.model} ${c.year}`.trim() },
    { key: "Couleur", value: `${c.colorName} (${c.color})` },
    { key: "Finition", value: c.finish },
    { key: "Jantes", value: `${c.wheelStyle} / ${c.wheelColor}` },
    { key: "Aileron", value: c.spoiler },
    { key: "Plaque", value: c.plate || "—" },
  ];

  const lines = [{ merchandiseId: main, quantity: 1, attributes }];
  for (const id of [c.spoiler, ...c.accessories]) {
    const v = extraVariant[id];
    if (v) lines.push({ merchandiseId: v, quantity: 1, attributes: [] });
  }

  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE_DOMAIN}/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": process.env.SHOPIFY_STOREFRONT_TOKEN!,
      },
      body: JSON.stringify({
        query: `mutation cartCreate($input: CartInput!) {
          cartCreate(input: $input) {
            cart { checkoutUrl }
            userErrors { field message }
          }
        }`,
        variables: { input: { lines } },
      }),
    }
  );

  const json = await res.json();
  const errors = json?.data?.cartCreate?.userErrors ?? json?.errors;
  if (errors?.length) throw new Error(errors.map((e: { message: string }) => e.message).join(", "));
  return json.data.cartCreate.cart.checkoutUrl;
}
