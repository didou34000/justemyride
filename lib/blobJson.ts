import { getFile, putFile } from "@/lib/store";

/** Petits fichiers JSON dans le stockage (fiches de demande, compteurs, résultats). */
export async function readJson<T>(pathname: string): Promise<T | null> {
  const r = await getFile(pathname, true);
  if (!r) return null;
  return JSON.parse(await new Response(r.stream).text()) as T;
}

export const writeJson = (pathname: string, data: unknown) => putFile(pathname, JSON.stringify(data, null, 2), "application/json");

/** Fichier privé → octets + type (pour les envoyer à une API qui ne lit pas le stockage privé). */
export async function readBytes(pathname: string) {
  const r = await getFile(pathname);
  if (!r) throw new Error(`Fichier introuvable : ${pathname}`);
  return {
    data: Buffer.from(await new Response(r.stream).arrayBuffer()),
    type: r.contentType === "application/octet-stream" ? "image/jpeg" : r.contentType,
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
