import { NextResponse } from "next/server";
import { storageMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

export function GET() {
  const mode = storageMode();
  return NextResponse.json({ enabled: mode !== null, mode });
}
