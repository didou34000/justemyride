import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import AdminLogin from "@/components/AdminLogin";
import AdminLogout from "@/components/AdminLogout";
import AdminPurge from "@/components/AdminPurge";
import LiveRefresh from "@/components/LiveRefresh";
import { Flow } from "@/components/Flow";
import OrderRow, { GUIDE } from "@/components/OrderRow";
import { adminSession } from "@/lib/adminSession";
import { listOrders, type Order } from "@/lib/orders";
import { storageEnabled } from "@/lib/storage";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await adminSession()))
    return (
      <main>
        <Nav link={{ href: "/", label: "Accueil", ghost: true }} />
        <AdminLogin />
      </main>
    );

  const orders = storageEnabled() ? await listOrders().catch(() => [] as Order[]) : [];

  return (
    <main>
      <Nav link={{ href: "/", label: "Accueil", ghost: true }} />
      <section className="admin wide">
        <div className="admin-top">
          <div>
            <p className="eyebrow">Espace admin</p>
            <h2>Les commandes</h2>
          </div>
          <span className="admin-top-r">
            <Link href="/admin/bibliotheque" className="cta ghost">Bibliothèque de pièces 3D</Link>
            <LiveRefresh every={30} />
            <AdminLogout />
          </span>
        </div>

        {!storageEnabled() && <p className="notice">Le stockage n&apos;est pas branché : aucune demande à afficher.</p>}
        {storageEnabled() && !orders.length && <p className="notice">Aucune demande pour l&apos;instant. La première apparaîtra ici toute seule.</p>}
        <div className="order-rows">
          {orders.map((o) => (
            <OrderRow key={o.id} o={o} href={`/admin/demande/${o.id}`} />
          ))}
        </div>
        {orders.length > 0 && <AdminPurge orders={orders.map((o) => ({ id: o.id, car: o.demande.car || o.demande.base?.label || "Voiture", email: o.demande.email, date: o.demande.receivedAt ?? "" }))} />}

        <h3>Le circuit d&apos;une commande</h3>
        <p className="sub">Chaque couleur dit qui agit : bleu le client, orange Claude, violet toi, jaune Blender, gris l&apos;atelier.</p>
        <Flow steps={GUIDE} />
      </section>
    </main>
  );
}
