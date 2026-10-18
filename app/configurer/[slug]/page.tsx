import { notFound } from "next/navigation";
import Configurator3D from "@/components/Configurator3D";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { carBySlug, cars } from "@/lib/cars";

export function generateStaticParams() {
  return cars.filter((c) => c.available).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const car = carBySlug((await params).slug);
  return { title: car ? `${car.make} ${car.model} — JustMyRide` : "JustMyRide" };
}

export default async function CarPage({ params }: { params: Promise<{ slug: string }> }) {
  const car = carBySlug((await params).slug);
  if (!car) notFound();
  return (
    <main>
      <Nav link={{ href: "/configurer", label: "Changer de voiture" }} />
      <Configurator3D
        model={{
          key: car.slug,
          name: `${car.make} ${car.model}`,
          subtitle: car.years,
          url: car.glb!,
          lengthM: car.lengthM,
          roles: car.roles,
        }}
      />
      <Footer />
    </main>
  );
}
