import { issueSignedToken } from "@vercel/blob";
import {
  handleUpload,
  handleUploadPresigned,
  type HandleUploadBody,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { FICHIERS } from "@/lib/fichiers";
import { storageMode } from "@/lib/storage";
import { presignUpload } from "@/lib/store";

/**
 * Envoi direct navigateur → stockage (Vercel Blob ou R2) pour le propriétaire (image des logos, miniature assemblée).
 * Même principe que /api/upload, mais réservé à l'admin et limité aux fichiers de lib/fichiers.
 */
const TYPES = ["image/*", "model/gltf-binary", "application/octet-stream"];
const MAX = 200 * 1024 * 1024;
const PATH = new RegExp(`^submissions/[\\w-]{6,40}/(${FICHIERS.join("|")})\\.(png|jpe?g|webp|glb)$`);

export async function POST(request: Request) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const mode = storageMode();
  if (!mode) return NextResponse.json({ error: "Stockage non configuré" }, { status: 503 });

  const checkPath = (pathname: string) => {
    if (!PATH.test(pathname)) throw new Error("Chemin refusé");
  };

  try {
    if (mode === "r2") {
      const { pathname } = await request.json();
      checkPath(String(pathname));
      return NextResponse.json(await presignUpload(pathname));
    }
    if (mode === "token") {
      const body = (await request.json()) as HandleUploadBody;
      const json = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async (pathname) => {
          checkPath(pathname);
          return { allowedContentTypes: TYPES, maximumSizeInBytes: MAX, addRandomSuffix: true };
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
          allowedContentTypes: TYPES,
          maximumSizeInBytes: MAX,
          validUntil: Date.now() + 60 * 60 * 1000,
        });
        return { token, urlOptions: { allowedContentTypes: TYPES, maximumSizeInBytes: MAX, addRandomSuffix: true } };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
