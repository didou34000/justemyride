import { NextResponse } from "next/server";
import { search, type SearchKind } from "@/lib/sketchfab";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  const kind = (["car", "rim", "exhaust"].includes(params.get("kind") ?? "") ? params.get("kind") : "car") as SearchKind;
  if (q.length < 2) return NextResponse.json({ results: [] });
  try {
    return NextResponse.json({ results: await search(q, kind) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
