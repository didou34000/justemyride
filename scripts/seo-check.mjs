// Contrôle SEO après `npm run build` : lit le HTML généré dans .next/ et s'arrête au premier lot d'erreurs.
// Lancer : npm run build && npm run seo:check
// Aucune dépendance : seulement Node. Le sitemap sert de liste des pages indexables.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd(), ".next/server/app");
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://justemyride.vercel.app").replace(/\/+$/, "");
const errors = [];
const fail = (page, msg) => errors.push(`${page} : ${msg}`);

if (!existsSync(ROOT)) {
  console.error("Pas de build trouvé : lance d'abord `npm run build`.");
  process.exit(1);
}

// --- Fichiers générés -------------------------------------------------------------------------------------
const htmlFiles = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith(".html")) htmlFiles.push(p);
  }
})(ROOT);
const routeOf = (file) => {
  const r = "/" + relative(ROOT, file).replace(/\.html$/, "").replace(/(^|\/)index$/, "");
  return r === "/" ? "/" : r.replace(/\/$/, "");
};
const pages = new Map(htmlFiles.map((f) => [routeOf(f), readFileSync(f, "utf8")]));

const decode = (s) =>
  s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const head = (html) => html.slice(0, html.indexOf("</head>"));
const meta = (html, attr, name) => {
  const m = head(html).match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`));
  return m ? decode(m[1]) : null;
};
const title = (html) => {
  const m = head(html).match(/<title>([^<]*)<\/title>/);
  return m ? decode(m[1]) : null;
};
const canonical = (html) => head(html).match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? null;
const visibleText = (html) =>
  decode(
    html
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<style[\s\S]*?<\/style>/g, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ");
const PLACEHOLDER = /undefined|NaN|\[object Object\]|TODO|lorem|\{\{/i;

// --- robots.txt -------------------------------------------------------------------------------------------
const robots = readFileSync(join(ROOT, "robots.txt.body"), "utf8");
if (/^Disallow:\s*\/\s*$/m.test(robots)) fail("robots.txt", "bloque tout le site (Disallow: /)");
if (!robots.includes(`Sitemap: ${SITE}/sitemap.xml`)) fail("robots.txt", `ne cite pas ${SITE}/sitemap.xml`);
for (const path of ["/configurer", "/cgv", "/_next/"])
  if (robots.split("\n").some((l) => l.startsWith("Disallow:") && path.startsWith(l.slice(9).trim()) && l.slice(9).trim()))
    fail("robots.txt", `bloque ${path}, nécessaire à l'affichage ou à l'indexation`);

// --- sitemap.xml ------------------------------------------------------------------------------------------
const sitemap = readFileSync(join(ROOT, "sitemap.xml.body"), "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (new Set(locs).size !== locs.length) fail("sitemap.xml", "contient des doublons");
for (const must of [SITE, `${SITE}/configurer`]) if (!locs.includes(must)) fail("sitemap.xml", `il manque ${must}`);

const indexable = [];
for (const loc of locs) {
  if (!loc.startsWith(SITE)) {
    fail("sitemap.xml", `adresse hors du domaine du site : ${loc}`);
    continue;
  }
  const route = loc.slice(SITE.length) || "/";
  if (/^\/(admin|api)(\/|$)|^\/configurer\/sketchfab\//.test(route)) fail("sitemap.xml", `page privée ou interne listée : ${route}`);
  if (!pages.has(route)) fail("sitemap.xml", `${route} n'est pas une page générée (404 ou rendu à la demande)`);
  else indexable.push(route);
}

// --- Pages indexables -------------------------------------------------------------------------------------
const titles = new Map();
const descriptions = new Map();
for (const route of indexable) {
  const html = pages.get(route);
  const t = title(html);
  const d = meta(html, "name", "description");
  const c = canonical(html);
  const expected = route === "/" ? SITE : SITE + route;

  if (!/<html lang="fr"/.test(html)) fail(route, 'il manque lang="fr"');
  if (!t) fail(route, "pas de <title>");
  if (!d) fail(route, "pas de meta description");
  for (const [k, v] of [["titre", t], ["description", d]]) if (v && PLACEHOLDER.test(v)) fail(route, `${k} contient un reste de gabarit : « ${v} »`);
  if (t) titles.set(t, [...(titles.get(t) ?? []), route]);
  if (d) descriptions.set(d, [...(descriptions.get(d) ?? []), route]);

  if (c !== expected) fail(route, `canonique « ${c} » au lieu de « ${expected} »`);
  const ogUrl = meta(html, "property", "og:url");
  if (ogUrl !== expected) fail(route, `og:url « ${ogUrl} » au lieu de « ${expected} »`);
  for (const p of ["og:title", "og:description", "og:image"]) if (!meta(html, "property", p)) fail(route, `il manque ${p}`);
  const ogImage = meta(html, "property", "og:image");
  if (ogImage && !ogImage.startsWith(SITE)) fail(route, `og:image n'est pas sur le domaine du site : ${ogImage}`);

  const robotsMeta = meta(html, "name", "robots");
  if (robotsMeta && /noindex/.test(robotsMeta)) fail(route, "marquée noindex alors qu'elle est dans le sitemap");

  const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1 !== 1) fail(route, `${h1} titres <h1> (il en faut un seul)`);

  // Données structurées : JSON valide, adresses absolues sur le domaine, prix visibles sur la page.
  const text = visibleText(html);
  for (const [, raw] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      fail(route, `JSON-LD invalide (${e.message})`);
      continue;
    }
    const nodes = data["@graph"] ?? [data];
    if (data["@context"] !== "https://schema.org") fail(route, "JSON-LD sans @context schema.org");
    const ids = nodes.map((n) => n["@id"]).filter(Boolean);
    if (new Set(ids).size !== ids.length) fail(route, "JSON-LD : @id en double");
    JSON.stringify(data, (k, v) => {
      if (["url", "item", "image", "logo"].includes(k) && typeof v === "string" && !v.startsWith(SITE))
        fail(route, `JSON-LD : ${k} non absolu ou hors domaine (${v})`);
      return v;
    });
    for (const n of nodes.filter((n) => n["@type"] === "Product")) {
      if (n.url !== expected) fail(route, `Product.url « ${n.url} » au lieu de « ${expected} »`);
      const o = n.offers ?? {};
      if (o.priceCurrency !== "EUR") fail(route, "Product : devise différente de EUR");
      for (const p of [o.price, o.lowPrice, o.highPrice].filter((p) => p !== undefined))
        if (!text.includes(`${p} €`)) fail(route, `Product : le prix ${p} € n'apparaît pas sur la page`);
      if (!/^https:\/\/schema\.org\/(InStock|MadeToOrder|PreOrder|OutOfStock|BackOrder)$/.test(o.availability ?? ""))
        fail(route, `Product : disponibilité inattendue (${o.availability})`);
      if (n.aggregateRating || n.review) fail(route, "Product : notes ou avis présents, à n'ajouter qu'avec de vrais avis");
    }
  }
}
for (const [t, routes] of titles) if (routes.length > 1) fail(routes.join(", "), `titre en double « ${t} »`);
for (const [d, routes] of descriptions) if (routes.length > 1) fail(routes.join(", "), "meta description en double");

// --- Pages générées hors sitemap : forcément noindex ------------------------------------------------------
for (const [route, html] of pages) {
  if (indexable.includes(route)) continue;
  const r = meta(html, "name", "robots");
  if (!r || !/noindex/.test(r)) fail(route, "page générée absente du sitemap mais indexable : l'ajouter au sitemap ou la passer en noindex");
}

// --- Liens internes ---------------------------------------------------------------------------------------
const DYNAMIC = [/^\/admin$/, /^\/configurer\/sketchfab\/[0-9a-f]{32}$/];
for (const [route, html] of pages) {
  for (const [, href] of html.matchAll(/<a [^>]*href="(\/[^"]*)"/g)) {
    const path = href.split(/[?#]/)[0] || "/";
    if (path.startsWith("/_next/") || /\.[a-z0-9]+$/i.test(path)) continue;
    if (!pages.has(path) && !DYNAMIC.some((re) => re.test(path))) fail(route, `lien interne vers une page qui n'existe pas : ${href}`);
  }
}

// --- Sources : pages privées --------------------------------------------------------------------------------
const src = (p) => readFileSync(join(process.cwd(), p), "utf8");
for (const p of ["app/admin/page.tsx", "app/admin/demande/[id]/page.tsx", "app/configurer/sketchfab/[uid]/page.tsx"])
  if (!/index:\s*false/.test(src(p))) fail(p, "devrait déclarer robots: { index: false }");
if (!/X-Robots-Tag/.test(src("next.config.mjs"))) fail("next.config.mjs", "il manque l'en-tête X-Robots-Tag pour /admin et /api");

// --- Bilan ----------------------------------------------------------------------------------------------------
if (errors.length) {
  console.error(`✗ ${errors.length} problème(s) SEO :\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`✓ SEO : ${indexable.length} pages indexables vérifiées (${indexable.join(", ")}), ${pages.size} pages générées, robots.txt et sitemap.xml cohérents.`);
