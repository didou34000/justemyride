import { NextResponse } from "next/server";
import { download, licenceOk, model } from "@/lib/sketchfab";

export async function GET(_req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  try {
    const info = await model(uid);
    if (!licenceOk(info.licence)) {
      return NextResponse.json({ error: `Licence « ${info.licence} » : vente interdite.` }, { status: 403 });
    }
    return NextResponse.json({ ...info, file: await download(uid) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
