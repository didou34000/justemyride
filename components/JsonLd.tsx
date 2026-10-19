import { jsonLd } from "@/lib/site";

/** Bloc de données structurées schema.org, rendu dans le HTML initial. */
export default function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />;
}
