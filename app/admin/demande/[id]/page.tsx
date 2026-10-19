import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import AdminLogin from "@/components/AdminLogin";
import AdminDemande from "@/components/AdminDemande";
import { adminSession } from "@/lib/adminSession";
import { getOrder } from "@/lib/orders";

export const metadata: Metadata = { title: "Demande", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await adminSession()))
    return (
      <main>
        <Nav link={{ href: "/", label: "Accueil", ghost: true }} />
        <AdminLogin />
      </main>
    );
  if (!/^[\w-]{6,40}$/.test(id)) notFound();
  const order = await getOrder(id);
  if (!order) notFound();
  return (
    <main>
      <Nav link={{ href: "/admin", label: "Tableau de bord", ghost: true }} />
      <AdminDemande order={order} />
      <p className="admin-back">
        <Link href="/admin" className="link">← Toutes les demandes</Link>
      </p>
    </main>
  );
}
