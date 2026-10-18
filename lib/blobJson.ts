import { get, put } from "@vercel/blob";
import { BLOB_ACCESS } from "@/lib/storage";

/** Petits fichiers JSON dans le stockage (fiches de demande, compteurs, résultats). */
export async function readJson<T>(pathname: string): Promise<T | null> {
  const r = await get(pathname, { access: BLOB_ACCESS, useCache: false }).catch(() => null);
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text()) as T;
}

export const writeJson = (pathname: string, data: unknown) =>
  put(pathname, JSON.stringify(data, null, 2), {
    access: BLOB_ACCESS,
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

/** Fichier privé → octets + type (pour les envoyer à une API qui ne lit pas le stockage privé). */
export async function readBytes(pathname: string) {
  const r = await get(pathname, { access: BLOB_ACCESS });
  if (!r || r.statusCode !== 200) throw new Error(`Fichier introuvable : ${pathname}`);
  return {
    data: Buffer.from(await new Response(r.stream).arrayBuffer()),
    type: r.headers.get("content-type") || "image/jpeg",
  };
}

type Usage = { days: Record<string, number>; total: number };

/**
 * Compteur jour / mois pour un service payant (prefix = "meshy", "analyse"…).
 * check() lève une erreur si un plafond est atteint ; add() compte une utilisation.
 */
export function usageCounter(prefix: string, dailyLimit: number, monthlyLimit: number) {
  const path = (d: Date) => `${prefix}/usage-${d.toISOString().slice(0, 7)}.json`;
  return {
    async read(now = new Date()) {
      const u = (await readJson<Usage>(path(now))) ?? { days: {}, total: 0 };
      const today = u.days[now.toISOString().slice(0, 10)] ?? 0;
      return { today, month: u.total, dailyLimit, monthlyLimit, raw: u };
    },
    async check(now = new Date()) {
      const u = await this.read(now);
      if (u.today >= dailyLimit) throw new Error(`Plafond du jour atteint (${dailyLimit})`);
      if (u.month >= monthlyLimit) throw new Error(`Plafond du mois atteint (${monthlyLimit})`);
      return u;
    },
    async add(now = new Date()) {
      const u = await this.read(now);
      const day = now.toISOString().slice(0, 10);
      u.raw.days[day] = (u.raw.days[day] ?? 0) + 1;
      u.raw.total += 1;
      await writeJson(path(now), u.raw);
    },
  };
}

export const num = (v: string | undefined, d: number) => (v && /^\d+$/.test(v) ? Number(v) : d);
