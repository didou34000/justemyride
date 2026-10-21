// Les photos montrent des plaques et parfois des adresses : stockage privé par défaut.
// Le store Vercel Blob doit être créé avec le même mode d'accès.
export const BLOB_ACCESS: "public" | "private" =
  process.env.NEXT_PUBLIC_BLOB_ACCESS === "public" ? "public" : "private";

/** Par photo : elles sont réduites dans le navigateur avant l'envoi, cette limite ne sert que si la réduction échoue. */
export const MAX_FILE_BYTES = 30 * 1024 * 1024;
export const ALLOWED_TYPES = ["image/*"];

/**
 * Trois façons de brancher le stockage :
 * - "r2"    : Cloudflare R2 (10 Go gratuits), avec R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY et R2_BUCKET.
 *   Prioritaire dès que ces 4 variables sont là ; le navigateur envoie alors ses fichiers par URL présignée ;
 * - "token" : Vercel Blob, ancienne connexion, avec BLOB_READ_WRITE_TOKEN ;
 * - "oidc"  : Vercel Blob, connexion actuelle, avec BLOB_STORE_ID (+ BLOB_WEBHOOK_PUBLIC_KEY) et le jeton OIDC
 *   que Vercel fournit lui-même aux fonctions. Les envois du navigateur passent alors par des URL présignées.
 */
export type StorageMode = "r2" | "token" | "oidc";

export const r2Configured = () =>
  Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);

export function storageMode(): StorageMode | null {
  if (r2Configured()) return "r2";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "token";
  if (process.env.BLOB_STORE_ID) return "oidc";
  return null;
}

export function storageEnabled() {
  return storageMode() !== null;
}
