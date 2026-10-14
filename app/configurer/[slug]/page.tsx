import { notFound } from "next/navigation";
import Configurator3D from "@/components/Configurator3D";
import Nav from "@/components/Nav";
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
      <Configurator3D car={car} />
      <footer className="foot">© {new Date().getFullYear()} JustMyRide</footer>
    </main>
  );
}
