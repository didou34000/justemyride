import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { MAX_FILE_BYTES, storageEnabled } from "@/lib/storage";

/** Délivre un jeton d'envoi direct navigateur → Vercel Blob (pas de limite de taille de requête). */
export async function POST(request: Request) {
  if (!storageEnabled()) {
    return NextResponse.json({ error: "Stockage non configuré" }, { status: 503 });
  }

  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("submissions/")) throw new Error("Chemin refusé");
        return {
          allowedContentTypes: ["image/*", "video/*"],
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
