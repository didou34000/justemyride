import { issueSignedToken } from "@vercel/blob";
import {
  handleUpload,
  handleUploadPresigned,
  type HandleUploadBody,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { ALLOWED_TYPES, MAX_FILE_BYTES, storageMode } from "@/lib/storage";

/**
 * Autorise un envoi direct navigateur → Vercel Blob (pas de limite de taille de requête).
 * Mode "token" : jeton client signé avec BLOB_READ_WRITE_TOKEN.
 * Mode "oidc"  : URL présignée, obtenue avec le jeton OIDC de Vercel et BLOB_STORE_ID.
 */
export async function POST(request: Request) {
  const mode = storageMode();
  if (!mode) {
    return NextResponse.json({ error: "Stockage non configuré" }, { status: 503 });
  }

  const checkPath = (pathname: string) => {
    if (!pathname.startsWith("submissions/")) throw new Error("Chemin refusé");
  };

  try {
    if (mode === "token") {
      const body = (await request.json()) as HandleUploadBody;
      const json = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async (pathname) => {
          checkPath(pathname);
          return { allowedContentTypes: ALLOWED_TYPES, maximumSizeInBytes: MAX_FILE_BYTES, addRandomSuffix: true };
        },
      });
      return NextResponse.json(json);
    }

    const body = (await request.json()) as HandleUploadPresignedBody;
    const json = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        checkPath(pathname);
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_FILE_BYTES,
          validUntil: Date.now() + 60 * 60 * 1000,
        });
        return {
          token,
          urlOptions: { allowedContentTypes: ALLOWED_TYPES, maximumSizeInBytes: MAX_FILE_BYTES, addRandomSuffix: true },
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
