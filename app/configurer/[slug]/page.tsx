import Link from "next/link";
import { notFound } from "next/navigation";
import Configurator3D from "@/components/Configurator3D";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import { carBySlug, cars, type Car } from "@/lib/cars";
import { accessories, sizes } from "@/lib/options";
import { LEAD_TIME } from "@/lib/legal";
import { abs, pageMeta, SITE_NAME, SITE_URL } from "@/lib/site";

// Seules les voitures prêtes ont une page : toute autre adresse donne une vraie 404, jamais une page vide.
export const dynamicParams = false;

export function generateStaticParams() {
  return cars.filter((c) => c.available).map((c) => ({ slug: c.slug }));
}

const low = Math.min(...sizes.map((s) => s.price));
const high = Math.max(...sizes.map((s) => s.price));
const scales = sizes.map((s) => s.label).join(", ").replace(/, ([^,]*)$/, " ou $1");

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const car = carBySlug((await params).slug);
  if (!car) return {};
  return pageMeta({
    title: `Miniature ${car.make} ${car.model} personnalisée (${car.years})`,
    description: `Personnalise ta ${car.make} ${car.model} en 3D : jantes, échappement, couleur, étriers. Miniature fabriquée à la commande en ${scales}, de ${low} à ${high} €.`,
    path: `/configurer/${car.slug}`,
    ...(car.thumb ? { image: { url: car.thumb, width: 900, height: 450, alt: `Aperçu 3D de la ${car.make} ${car.model}` } } : {}),
  });
}

/**
 * Produit schema.org : prix et disponibilité tirés des mêmes données que la page (lib/options.ts).
 * « MadeToOrder » : chaque miniature est fabriquée à la commande. Pas de note, d'avis ni d'identifiant inventés.
 */
function productLd(car: Car) {
  const url = abs(`/configurer/${car.slug}`);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${url}#product`,
        name: `Miniature personnalisée ${car.make} ${car.model}`,
        description: `Miniature de ${car.make} ${car.model} (${car.years}) fabriquée en pièce unique, personnalisable : jantes, échappement, couleur, finition et étriers. Socle rond blanc inclus.`,
        url,
        ...(car.thumb ? { image: abs(car.thumb) } : {}),
        brand: { "@type": "Brand", name: SITE_NAME },
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "EUR",
          lowPrice: low,
          highPrice: high,
          offerCount: sizes.length,
          availability: "https://schema.org/MadeToOrder",
          seller: { "@id": `${SITE_URL}/#store` },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: abs("/") },
          { "@type": "ListItem", position: 2, name: "Le garage", item: abs("/configurer") },
          { "@type": "ListItem", position: 3, name: `${car.make} ${car.model}`, item: url },
        ],
      },
    ],
  };
}

export default async function CarPage({ params }: { params: Promise<{ slug: string }> }) {
  const car = carBySlug((await params).slug);
  if (!car) notFound();
  const name = `${car.make} ${car.model}`;
  return (
    <main>
      <JsonLd data={productLd(car)} />
      <Nav link={{ href: "/configurer", label: "Changer de voiture", ghost: true }} />
      <Configurator3D
        model={{
          key: car.slug,
          name,
          subtitle: car.years,
          url: car.glb!,
          lengthM: car.lengthM,
          roles: car.roles,
        }}
      />

      {/* Ce qu'il faut savoir avant de commander : lisible sans la 3D, dans le HTML de la page. */}
      <section className="car-info">
        <nav className="crumbs" aria-label="Fil d'Ariane">
          <Link href="/">Accueil</Link> › <Link href="/configurer">Le garage</Link> › <span>{name}</span>
        </nav>
        <h2>
          Ta {name}, <i>en miniature.</i>
        </h2>
        <p>
          On part d'un modèle 3D de la {name} ({car.years}). Tu choisis les jantes, l'échappement, la couleur et sa
          finition, la couleur des étriers, puis la taille : l'aperçu 3D se met à jour à chaque choix. La miniature est
          ensuite fabriquée à la commande, en pièce unique.
        </p>
        <dl className="car-facts">
          <div>
            <dt>Tailles et prix</dt>
            <dd>
              {sizes.map((s) => (
                <span key={s.id} className="car-size">
                  {s.label} ({s.length}) : <b>{s.price} €</b>
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt>Inclus</dt>
            <dd>
              Socle rond blanc. En option : {accessories.map((a) => `${a.label.toLowerCase()} (+${a.price} €)`).join(", ")}.
            </dd>
          </div>
          <div>
            <dt>Fabrication et livraison</dt>
            <dd>Environ {LEAD_TIME} de fabrication, puis le transport. Livraison standard offerte en France.</dd>
          </div>
          <div>
            <dt>Retours</dt>
            <dd>
              Pièce sur mesure : pas de rétractation. Abîmée ou non conforme, on la refait ou on te rembourse.{" "}
              <Link href="/cgv" className="link">Voir les CGV</Link>
            </dd>
          </div>
        </dl>
        <p className="hint">
          Ta voiture est modifiée ou ce n'est pas exactement ce modèle ?{" "}
          <Link href="/miniature" className="link">Envoie-nous tes photos</Link>, on la recrée telle qu'elle est.
        </p>
      </section>
      <Footer />
    </main>
  );
}
