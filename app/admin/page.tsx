import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import AdminLogin from "@/components/AdminLogin";
import AdminLogout from "@/components/AdminLogout";
import Timeline from "@/components/Timeline";
import { adminSession } from "@/lib/adminSession";
import { listOrders, STEPS, type Order } from "@/lib/orders";
import { storageEnabled } from "@/lib/storage";
import { analyseConfigured, analyseUsage } from "@/lib/analyse";
import { meshyConfigured, usage as meshyUsage } from "@/lib/meshy";

export const metadata: Metadata = { title: "Admin · JustMyRide", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "");

function current(o: Order) {
  return o.steps.find((s) => s.state === "error") ?? o.steps.find((s) => s.state === "current");
}

export default async function AdminPage() {
  if (!(await adminSession()))
    return (
      <main>
        <Nav link={{ href: "/", label: "Accueil" }} />
        <AdminLogin />
      </main>
    );

  const orders = storageEnabled() ? await listOrders().catch(() => [] as Order[]) : [];
  const [au, mu] = await Promise.all([
    analyseConfigured() ? analyseUsage().catch(() => null) : null,
    meshyConfigured() ? meshyUsage().catch(() => null) : null,
  ]);
  const enCours = orders.filter((o) => o.progress < 1);

  return (
    <main>
      <Nav link={{ href: "/", label: "Accueil" }} />
      <section className="admin wide">
        <div className="admin-top">
          <div>
            <p className="eyebrow">Espace admin</p>
            <h2>Tableau de bord</h2>
          </div>
          <AdminLogout />
        </div>

        <div className="admin-stats">
          <div><b>{orders.length}</b><span>demandes</span></div>
          <div><b>{enCours.length}</b><span>en cours</span></div>
          <div><b>{orders.length - enCours.length}</b><span>terminées</span></div>
          <div>
            <b>{au ? `${au.today}/${au.dailyLimit}` : "off"}</b>
            <span>analyses aujourd&apos;hui{au ? ` · ${au.month}/${au.monthlyLimit} ce mois` : " (clé Claude manquante)"}</span>
          </div>
          <div>
            <b>{mu ? `${mu.today}/${mu.dailyLimit}` : "off"}</b>
            <span>Meshy aujourd&apos;hui{mu ? ` · ${mu.month}/${mu.monthlyLimit} ce mois` : ""}</span>
          </div>
        </div>

        <h3>Comment une commande avance</h3>
        <ol className="parcours">
          {STEPS.map((s, i) => (
            <li key={s.key}>
              <span className="parcours-n">{i + 1}</span>
              <strong>{s.label}</strong>
              <em>{s.who}</em>
              <p>{s.help}</p>
            </li>
          ))}
        </ol>

        <h3>Les demandes</h3>
        {!storageEnabled() && <p className="notice">Le stockage n&apos;est pas branché : aucune demande à afficher.</p>}
        {storageEnabled() && !orders.length && <p className="notice">Aucune demande pour l&apos;instant.</p>}
        <div className="orders">
          {orders.map((o) => {
            const c = current(o);
            return (
              <Link key={o.id} href={`/admin/demande/${o.id}`} className="order">
                <div className="order-head">
                  <strong>{o.demande.car || o.demande.base?.label || "Voiture"}</strong>
                  <span>{day(o.demande.receivedAt)}</span>
                </div>
                <span className="sub">{o.demande.email}</span>
                <Timeline steps={o.steps} compact />
                <span className={`order-next ${c?.state ?? "done"}`}>
                  {c ? `${c.state === "error" ? "Bloqué" : "Prochaine étape"} : ${c.label} (${c.who})` : "Terminée"}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
