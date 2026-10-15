/** Accès à l'API Sketchfab, côté serveur uniquement (la clé ne part jamais au navigateur). */
const API = "https://api.sketchfab.com/v3";

/** Licences qui autorisent la vente et la modification. */
export function licenceOk(label = "") {
  return !/NonCommercial|NoDerivs|Editorial/i.test(label);
}

type Img = { url: string; width: number };
type Raw = {
  uid: string;
  name: string;
  viewerUrl: string;
  faceCount?: number;
  user?: { displayName?: string; username?: string; profileUrl?: string };
  license?: { label?: string } | string | null;
  thumbnails?: { images?: Img[] };
  archives?: Record<string, { size?: number } | null>;
};

export type SketchfabHit = {
  uid: string;
  name: string;
  author: string;
  authorUrl?: string;
  licence: string;
  thumb?: string;
  faces?: number;
  sizeMb?: number;
  viewerUrl: string;
};

const label = (l: Raw["license"]) => (typeof l === "string" ? l : l?.label ?? "");

export function toHit(r: Raw): SketchfabHit {
  const imgs = [...(r.thumbnails?.images ?? [])].sort((a, b) => a.width - b.width);
  const thumb = imgs.find((i) => i.width >= 400) ?? imgs[imgs.length - 1];
  const size = r.archives?.glb?.size ?? r.archives?.gltf?.size;
  return {
    uid: r.uid,
    name: r.name,
    author: r.user?.displayName || r.user?.username || "?",
    authorUrl: r.user?.profileUrl,
    licence: label(r.license),
    thumb: thumb?.url,
    faces: r.faceCount,
    sizeMb: size ? Math.round(size / 1e6) : undefined,
    viewerUrl: r.viewerUrl,
  };
}

export type SearchKind = "car" | "rim" | "exhaust";

/** Mots ajoutés à la recherche pour les pièces, et taille max (Mo) acceptée. */
const KIND: Record<SearchKind, { extra: string; maxMb: number; category?: string }> = {
  car: { extra: "", maxMb: 80, category: "cars-vehicles" },
  rim: { extra: "rim", maxMb: 30 },
  exhaust: { extra: "exhaust tip", maxMb: 20 },
};

export async function search(q: string, kind: SearchKind = "car"): Promise<SketchfabHit[]> {
  const k = KIND[kind];
  const query = k.extra && !new RegExp(k.extra.split(" ")[0], "i").test(q) ? `${q} ${k.extra}` : q;
  const url = new URL(`${API}/search`);
  const params: Record<string, string> = { type: "models", q: query, downloadable: "true", count: "24" };
  if (k.category) params.categories = k.category;
  url.search = new URLSearchParams(params).toString();
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Recherche Sketchfab : ${res.status}`);
  const json = (await res.json()) as { results?: Raw[] };
  return (json.results ?? [])
    .map(toHit)
    .filter((h) => licenceOk(h.licence) && (h.sizeMb ?? 0) <= k.maxMb);
}

export async function model(uid: string) {
  const res = await fetch(`${API}/models/${encodeURIComponent(uid)}`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Modèle introuvable (${res.status})`);
  return toHit((await res.json()) as Raw);
}

/** Liens de téléchargement temporaires (quelques minutes), via le compte de la boutique. */
export async function download(uid: string) {
  const token = process.env.SKETCHFAB_API_TOKEN;
  if (!token) throw new Error("SKETCHFAB_API_TOKEN n'est pas configurée sur Vercel.");
  const res = await fetch(`${API}/models/${encodeURIComponent(uid)}/download`, {
    headers: { Authorization: `Token ${token}` },
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) throw new Error("Sketchfab refuse la clé API (clé invalide ou modèle non téléchargeable).");
  if (!res.ok) throw new Error(`Téléchargement Sketchfab : ${res.status}`);
  const json = (await res.json()) as Record<string, { url: string; size: number } | undefined>;
  if (json.glb?.url) return { url: json.glb.url, zip: false, size: json.glb.size };
  if (json.gltf?.url) return { url: json.gltf.url, zip: true, size: json.gltf.size };
  throw new Error("Ce modèle n'a pas de version glTF téléchargeable.");
}
