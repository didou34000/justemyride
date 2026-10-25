import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import AdminLogin from "@/components/AdminLogin";
import Bibliotheque from "@/components/Bibliotheque";
import { adminSession } from "@/lib/adminSession";
import { listElements } from "@/lib/bibliotheque";
import { storageEnabled } from "@/lib/storage";

export const metadata: Metadata = { title: "Bibliothèque", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await adminSession()))
    return (
      <main>
        <Nav link={{ href: "/", label: "Accueil", ghost: true }} />
        <AdminLogin />
      </main>
    );
  return (
    <main>
      <Nav link={{ href: "/admin", label: "Tableau de bord", ghost: true }} />
      <section className="admin wide">
        <div className="admin-top">
          <div>
            <p className="eyebrow">Espace admin</p>
            <h2>La bibliothèque de pièces 3D</h2>
          </div>
        </div>
        <Bibliotheque initial={await listElements()} storage={storageEnabled()} />
      </section>
      <p className="admin-back">
        <Link href="/admin" className="link">← Toutes les demandes</Link>
      </p>
    </main>
  );
}
