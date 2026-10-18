import type { MetadataRoute } from "next";
import { SELLER } from "@/lib/legal";
import { cars } from "@/lib/cars";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/configurer", "/cgv", "/confidentialite", "/mentions-legales"];
  return [
    ...pages.map((p) => ({ url: `${SELLER.site}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.5 })),
    ...cars.filter((c) => c.available).map((c) => ({ url: `${SELLER.site}/configurer/${c.slug}`, priority: 0.8 })),
  ];
}
