// Les photos montrent des plaques et parfois des adresses : stockage privé par défaut.
// Le store Vercel Blob doit être créé avec le même mode d'accès.
export const BLOB_ACCESS: "public" | "private" =
  process.env.NEXT_PUBLIC_BLOB_ACCESS === "public" ? "public" : "private";

export const MAX_FILE_BYTES = 500 * 1024 * 1024;

export function storageEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}
