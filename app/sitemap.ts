import type { MetadataRoute } from "next";
import { abs, INDEXABLE_PATHS } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_PATHS.map((p) => ({ url: abs(p) }));
}
