"use client";

import { upload, uploadPresigned } from "@vercel/blob/client";
import { BLOB_ACCESS, type StorageMode } from "@/lib/storage";

type Options = {
  /** Route qui autorise l'envoi (/api/upload pour les clients, /api/admin/upload pour l'admin). */
  handleUploadUrl: string;
  mode: StorageMode;
  contentType?: string;
  headers?: Record<string, string>;
  onProgress?: (loaded: number) => void;
};

/**
 * Envoi direct navigateur → stockage, sans passer par le serveur (pas de limite de taille de requête).
 * R2 : la route renvoie une URL présignée, le fichier part en PUT. Vercel Blob : son propre client.
 * Renvoie le chemin final (avec son suffixe aléatoire).
 */
export async function sendFile(pathname: string, file: File, o: Options): Promise<{ pathname: string }> {
  const contentType = o.contentType || file.type || "application/octet-stream";
  if (o.mode === "r2") {
    const res = await fetch(o.handleUploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...o.headers },
      body: JSON.stringify({ pathname, contentType }),
    });
    const sign = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(sign.error ?? "Envoi refusé");
    await new Promise<void>((resolve, reject) => {
      // XMLHttpRequest plutôt que fetch : lui seul donne la progression de l'envoi.
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", sign.url);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.upload.onprogress = (e) => o.onProgress?.(e.loaded);
      xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Envoi refusé par le stockage (${xhr.status})`)));
      xhr.onerror = () => reject(new Error("Envoi interrompu : vérifie ta connexion"));
      xhr.send(file);
    });
    return { pathname: sign.pathname };
  }
  // Connexion Blob actuelle (OIDC) : envoi par URL présignée, en une seule requête.
  const put = o.mode === "oidc" ? uploadPresigned : upload;
  const blob = await put(pathname, file, {
    access: BLOB_ACCESS,
    handleUploadUrl: o.handleUploadUrl,
    headers: o.headers,
    ...(o.contentType ? { contentType: o.contentType } : {}),
    multipart: o.mode === "token" && file.size > 20 * 1024 * 1024,
    onUploadProgress: (e) => o.onProgress?.(e.loaded),
  });
  return { pathname: blob.pathname };
}
