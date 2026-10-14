import { NextResponse } from "next/server";
import { search } from "@/lib/sketchfab";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });
  try {
    return NextResponse.json({ results: await search(q) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
