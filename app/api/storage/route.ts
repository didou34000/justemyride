import { NextResponse } from "next/server";
import { storageMode } from "@/lib/storage";
import { alertsConfigured } from "@/lib/notify";

export const dynamic = "force-dynamic";

export function GET() {
  const mode = storageMode();
  return NextResponse.json({ enabled: mode !== null, mode, alerts: alertsConfigured() });
}
