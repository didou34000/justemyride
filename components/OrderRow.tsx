import Link from "next/link";
import { FlowMini } from "@/components/Flow";
import { photoSrc } from "@/lib/photo";
import { STEPS, type Step } from "@/lib/steps";
import type { Order } from "@/lib/orders";

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "");

/** La phrase d'état d'une demande : qui doit agir maintenant. */
function status(o: Order): { text: string; kind: string } {
  const err = o.steps.find((s) => s.state === "error");
  if (err) return { text: `Bloqué : ${err.label}`, kind: "error" };
  const cur = o.steps.find((s) => s.state === "current");
  if (!cur) return { text: "Terminée", kind: "done" };
  if (cur.who === "Toi") return { text: `À toi : ${cur.label}`, kind: "toi" };
  return { text: `${cur.who} : ${cur.label}`, kind: "current" };
}

const cover = (o: Order) => (o.demande.files.find((f) => f.slot === "avant-gauche" || f.slot === "avant") ?? o.demande.files[0])?.pathname;

/** Une demande dans la liste : photo, voiture, et son circuit en miniature. */
export default function OrderRow({ o, href }: { o: Order; href: string }) {
  const st = status(o);
  const img = cover(o);
  return (
    <Link href={href} className="order-row">
      <span className="order-img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img && <img src={photoSrc(img)} alt="" loading="lazy" />}
      </span>
      <span className="order-info">
        <strong>{o.demande.car || o.demande.base?.label || "Voiture"}</strong>
        <span className="sub">
          {o.demande.email} · {day(o.demande.receivedAt)}
        </span>
        <span className={`order-st ${st.kind}`}>{st.text}</span>
      </span>
      <FlowMini steps={o.steps} />
    </Link>
  );
}

export const GUIDE: Step[] = STEPS.map((s) => ({ key: s.key, label: s.label, who: s.who, state: "todo" }));

