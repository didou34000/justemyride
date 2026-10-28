import { createHash } from "node:crypto";
import { readJson, writeJson } from "@/lib/blobJson";
import { SUPABASE_ANON_KEY, SUPABASE_URL, authConfigured } from "@/lib/authShared";

export { authConfigured } from "@/lib/authShared";

/**
 * Comptes clients : 1 aperçu gratuit par adresse e-mail, les suivants à 5 € (payés sur Shopify, déduits de la miniature).
 * La connexion se fait chez Supabase (code par e-mail ou Google) ; ici on ne garde qu'une fiche par client,
 * dans le stockage : clients/<empreinte de l'e-mail>.json.
 */

export type Client = {
  email: string;
  /** Demandes envoyées ; `payee` = aperçu payé 5 €, à déduire de la commande. */
  apercus: { id: string; at: string; payee?: boolean }[];
  /** Aperçus payés pas encore utilisés. */
  credits: number;
  /** Commandes Shopify déjà comptées (le webhook peut arriver deux fois). */
  paiements: { order: string; at: string }[];
};

/** Gmail ignore les points et ce qui suit un « + » : une seule fiche pour toutes ces variantes. */
export function normalizeEmail(email: string) {
  const [user, domain] = email.trim().toLowerCase().split("@");
  if (!domain) return email.trim().toLowerCase();
  const d = domain === "googlemail.com" ? "gmail.com" : domain;
  const u = user.split("+")[0];
  return `${d === "gmail.com" ? u.replace(/\./g, "") : u}@${d}`;
}

export const clientKey = (email: string) => createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 32);
const path = (key: string) => `clients/${key}.json`;

export const readClient = async (key: string, email = ""): Promise<Client> =>
  (await readJson<Client>(path(key))) ?? { email, apercus: [], credits: 0, paiements: [] };
export const saveClient = (key: string, c: Client) => writeJson(path(key), c);

/** Adresses jetables courantes : pas d'aperçu gratuit avec. */
const JETABLES = new Set([
  "yopmail.com", "yopmail.fr", "yopmail.net", "mailinator.com", "guerrillamail.com", "guerrillamail.info", "sharklasers.com",
  "10minutemail.com", "10minutemail.net", "temp-mail.org", "tempmail.com", "tempmail.net", "tempmailo.com", "trashmail.com",
  "trashmail.fr", "jetable.org", "getnada.com", "nada.email", "dispostable.com", "maildrop.cc", "throwawaymail.com",
  "mohmal.com", "mailnesia.com", "emailondeck.com", "fakeinbox.com", "mintemail.com", "spamgourmet.com", "mytemp.email",
  "tempr.email", "discard.email", "moakt.com", "burnermail.io", "inboxkitten.com", "mail.tm", "mail.gw", "tmpmail.org",
  "tmpmail.net", "cuvox.de", "armyspy.com", "dayrep.com", "einrot.com", "fleckens.hu", "gustr.com", "jourrapide.com",
  "rhyta.com", "superrito.com", "teleworm.us", "crazymailing.com", "minuteinbox.com", "emailfake.com", "generator.email",
]);
export const isJetable = (email: string) => JETABLES.has(email.split("@")[1]?.toLowerCase() ?? "");

export type User = { id: string; email: string };

export const AUTH_DOWN = "La connexion est momentanément indisponible. Réessaie dans quelques minutes.";

/** Supabase ne répond pas (projet en pause, panne) : à distinguer d'un client simplement pas connecté. */
export class AuthDown extends Error {
  constructor() {
    super(AUTH_DOWN);
  }
}

/**
 * Client connecté d'après l'en-tête Authorization: Bearer <jeton Supabase>, vérifié auprès de Supabase.
 * null = pas connecté ; lève AuthDown si Supabase ne répond pas.
 */
export async function userFromRequest(request: Request): Promise<User | null> {
  if (!authConfigured()) return null;
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null);
  if (!res || res.status >= 500) throw new AuthDown();
  if (!res.ok) return null;
  const u = await res.json();
  // Code par e-mail et Google confirment tous les deux l'adresse.
  if (!u?.email || !(u.email_confirmed_at || u.confirmed_at)) return null;
  return { id: u.id, email: String(u.email).toLowerCase() };
}

/** Ce que le site montre au client : a-t-il encore droit à un aperçu, gratuit ou payé ? */
export function clientStatus(c: Client, email: string) {
  const gratuit = c.apercus.length === 0 && !isJetable(email);
  return { email, gratuit, credits: c.credits, peutEnvoyer: gratuit || c.credits > 0, jetable: isJetable(email) };
}
