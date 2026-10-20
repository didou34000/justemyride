"use client";

import { Analytics } from "@vercel/analytics/next";

/** Statistiques Vercel (sans cookie) ; les pages admin ne sont pas comptées. */
export default function SiteAnalytics() {
  return <Analytics beforeSend={(e) => (new URL(e.url).pathname.startsWith("/admin") ? null : e)} />;
}
