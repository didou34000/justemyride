import { del, get, list, put } from "@vercel/blob";
import { AwsClient } from "aws4fetch";
import { BLOB_ACCESS, r2Configured } from "@/lib/storage";

/**
 * Lecture / écriture des fichiers côté serveur, quel que soit le stockage branché (lib/storage.ts) :
 * Cloudflare R2 si ses variables sont dans Vercel, sinon Vercel Blob. Les chemins (submissions/<id>/…) sont les mêmes.
 * Tout reste privé : le navigateur passe par /api/admin/photo pour lire, et par une URL présignée pour envoyer.
 */

let client: AwsClient | null = null;
const r2 = () =>
  (client ??= new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    service: "s3",
    region: "auto",
  }));
const bucketUrl = () => `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}`;
const objectUrl = (pathname: string) => `${bucketUrl()}/${pathname.split("/").map(encodeURIComponent).join("/")}`;

export type StoredFile = { stream: ReadableStream<Uint8Array>; contentType: string };

/** Écrit (ou remplace) un fichier. */
export async function putFile(pathname: string, body: Buffer | Uint8Array | string, contentType: string) {
  if (r2Configured()) {
    const res = await r2().fetch(objectUrl(pathname), {
      method: "PUT",
      body: typeof body === "string" ? body : new Uint8Array(body),
      headers: { "Content-Type": contentType },
    });
    if (!res.ok) throw new Error(`Stockage R2 : envoi refusé (${res.status})`);
    return { pathname };
  }
  const size = typeof body === "string" ? body.length : body.byteLength;
  const blob = await put(pathname, typeof body === "string" ? body : Buffer.from(body), {
    access: BLOB_ACCESS,
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    multipart: size > 20 * 1024 * 1024,
  });
  return { pathname: blob.pathname };
}

/** Lit un fichier ; null s'il n'existe pas. `fresh` : jamais de cache (fiches JSON qui changent). */
export async function getFile(pathname: string, fresh = false): Promise<StoredFile | null> {
  if (r2Configured()) {
    const res = await r2().fetch(objectUrl(pathname), { cache: "no-store" }).catch(() => null);
    if (!res?.ok || !res.body) return null;
    return { stream: res.body, contentType: res.headers.get("content-type") || "application/octet-stream" };
  }
  const r = await get(pathname, { access: BLOB_ACCESS, ...(fresh ? { useCache: false } : {}) }).catch(() => null);
  if (!r || r.statusCode !== 200) return null;
  return { stream: r.stream, contentType: r.headers.get("content-type") || "application/octet-stream" };
}

/** Tous les chemins sous un préfixe. */
export async function listFiles(prefix: string): Promise<string[]> {
  const out: string[] = [];
  if (r2Configured()) {
    let token: string | undefined;
    do {
      const q = new URLSearchParams({ "list-type": "2", prefix, ...(token ? { "continuation-token": token } : {}) });
      const res = await r2().fetch(`${bucketUrl()}?${q}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Stockage R2 : liste refusée (${res.status})`);
      const xml = await res.text();
      for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) out.push(m[1].replace(/&amp;/g, "&"));
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? xml.match(/<NextContinuationToken>([^<]+)</)?.[1] : undefined;
    } while (token);
    return out;
  }
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    out.push(...page.blobs.map((b) => b.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

/** Efface tous les fichiers sous un préfixe ; renvoie leur nombre. */
export async function deletePrefix(prefix: string) {
  const paths = await listFiles(prefix);
  if (r2Configured()) {
    for (let i = 0; i < paths.length; i += 20)
      await Promise.all(paths.slice(i, i + 20).map((p) => r2().fetch(objectUrl(p), { method: "DELETE" })));
  } else {
    for (let i = 0; i < paths.length; i += 500) await del(paths.slice(i, i + 500));
  }
  return paths.length;
}

/**
 * URL présignée pour un envoi direct navigateur → R2 (PUT, valable 1 h), pour un chemin déjà vérifié par l'appelant.
 * Un suffixe aléatoire est ajouté au nom, comme le faisait Vercel Blob : un envoi n'écrase jamais un autre fichier.
 */
export async function presignUpload(pathname: string) {
  const final = pathname.replace(/(\.[\w]+)?$/, (ext) => `-${crypto.randomUUID().slice(0, 12)}${ext}`);
  const signed = await r2().sign(new Request(`${objectUrl(final)}?X-Amz-Expires=3600`, { method: "PUT" }), {
    aws: { signQuery: true },
  });
  return { url: signed.url, pathname: final };
}
