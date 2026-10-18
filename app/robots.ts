import type { MetadataRoute } from "next";
import { SELLER } from "@/lib/legal";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: `${SELLER.site}/sitemap.xml`,
  };
}
