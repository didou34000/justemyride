import { createHmac, timingSafeEqual } from "crypto";

/**
 * Accès admin du site.
 * - Le propriétaire se connecte sur /admin avec ADMIN_PASSWORD : on pose un cookie signé (30 jours).
 * - Les scripts peuvent aussi passer l'en-tête x-admin-token (ADMIN_TOKEN).
 * Le cookie est signé avec ADMIN_TOKEN : sans cette variable, aucun accès n'est possible.
 */

export const ADMIN_COOKIE = "jmr_admin";
const DAYS = 30;

const secret = () => process.env.ADMIN_TOKEN ?? "";
export const adminLoginEnabled = () => Boolean(process.env.ADMIN_PASSWORD && secret());

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const sign = (exp: string) => createHmac("sha256", secret()).update(`admin:${exp}`).digest("base64url");

export function passwordOk(given: unknown) {
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected && secret() && typeof given === "string" && same(given, expected));
}

/** Valeur du cookie et durée, à poser après un bon mot de passe. */
export function newSession() {
  const exp = String(Date.now() + DAYS * 86400_000);
  return { value: `${exp}.${sign(exp)}`, maxAge: DAYS * 86400 };
}

export function sessionOk(value: string | undefined) {
  if (!value || !secret()) return false;
  const [exp, sig] = value.split(".");
  return Boolean(exp && sig && Number(exp) > Date.now() && same(sig, sign(exp)));
}

function cookieFrom(request: Request) {
  const raw = request.headers.get("cookie") ?? "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`));
  return m?.[1];
}

/** Vrai si la requête vient du propriétaire (cookie de session ou en-tête x-admin-token). */
export function isAdmin(request: Request) {
  const token = request.headers.get("x-admin-token");
  if (token && secret() && same(token, secret())) return true;
  return sessionOk(cookieFrom(request));
}
