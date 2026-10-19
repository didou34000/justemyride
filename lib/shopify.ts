import { caliperColors, exhausts, finishes, heights, rimStyles, roofColors, stripeColors, tints, trims, wheelColors, type Config } from "./options";

const label = (list: { id: string; label: string }[], id: string) =>
  id === "origine" ? "D'origine" : list.find((o) => o.id === id)?.label ?? id;

const API_VERSION = "2025-07";

// Boutique et produits créés dans Shopify (« Miniature personnalisée », « Socle noir gravé », « Vitrine acrylique »).
// Ces identifiants ne sont pas secrets ; les variables d'environnement permettent d'en changer sans toucher au code.
const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || "jsgvit-dt.myshopify.com";

const sizeVariant: Record<string, string | undefined> = {
  "1-43": process.env.SHOPIFY_VARIANT_SCALE_43 || "gid://shopify/ProductVariant/54398137041243",
  "1-24": process.env.SHOPIFY_VARIANT_SCALE_24 || "gid://shopify/ProductVariant/54398137074011",
  "1-18": process.env.SHOPIFY_VARIANT_SCALE_18 || "gid://shopify/ProductVariant/54398137106779",
};

const extraVariant: Record<string, string | undefined> = {
  socle: process.env.SHOPIFY_VARIANT_BASE || "gid://shopify/ProductVariant/54398137139547",
  vitrine: process.env.SHOPIFY_VARIANT_CASE || "gid://shopify/ProductVariant/54398137205083",
};

/** Seule la clé Storefront (secrète) reste à fournir, sur Vercel. Sans elle : mode démo. */
export function shopifyConfigured() {
  return Boolean(process.env.SHOPIFY_STOREFRONT_TOKEN);
}

/** Crée un panier Shopify et renvoie l'URL de paiement hébergée par Shopify. */
export async function createCheckout(c: Config): Promise<string> {
  const main = sizeVariant[c.size];
  if (!main) throw new Error(`Variante Shopify manquante pour la taille ${c.size}`);

  // La configuration voyage avec la ligne principale : elle apparaît dans la commande.
  const attributes = [
    { key: "Voiture", value: c.carName },
    ...(c.source ? [{ key: "Modèle 3D", value: c.source }] : []),
    { key: "Couleur", value: c.paint === "origine" ? "D'origine" : `${c.paintName} (${c.paint})` },
    { key: "Finition", value: label(finishes, c.finish) },
    { key: "Jantes", value: `${c.rimPart ?? label(rimStyles, c.rims)} / ${label(wheelColors, c.rimColor)}` },
    { key: "Échappement", value: c.exhaustPart ?? label(exhausts, c.exhaust) },
    { key: "Étriers", value: label(caliperColors, c.caliper) },
    ...(c.roof && c.roof !== "origine" ? [{ key: "Toit", value: label(roofColors, c.roof) }] : []),
    ...(c.stripes && c.stripes !== "origine" ? [{ key: "Bandes", value: label(stripeColors, c.stripes) }] : []),
    { key: "Vitres", value: label(tints, c.tint) },
    { key: "Chromes", value: label(trims, c.trim) },
    { key: "Hauteur", value: label(heights, c.height) },
    ...(c.engraving?.trim() && c.accessories.includes("socle") ? [{ key: "Texte gravé", value: c.engraving.trim() }] : []),
  ];

  const lines = [{ merchandiseId: main, quantity: 1, attributes }];
  for (const id of c.accessories) {
    const v = extraVariant[id];
    if (v) lines.push({ merchandiseId: v, quantity: 1, attributes: [] });
  }

  const res = await fetch(
    `https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`,
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
