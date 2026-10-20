"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { STEPS, type Step, type Tone } from "@/lib/steps";
import type { Order } from "@/lib/orders";
import { photoSrc } from "@/lib/photo";

/**
 * Le circuit d'une commande en blocs reliés, façon n8n : un bloc par étape,
 * coloré selon qui agit, avec ce qu'il contient (photos, rapports de Claude, modèles 3D…).
 */

const TONE = Object.fromEntries(STEPS.map((s) => [s.key, s.tone])) as Record<string, Tone>;
const HELP = Object.fromEntries(STEPS.map((s) => [s.key, s.help])) as Record<string, string>;

const day = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

const ICON: Record<string, ReactNode> = {
  base: <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" />,
  photos: <path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
  rapport1: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5M8.5 11h5M11 8.5v5" />,
  couleurs: <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-1.3-1.1-1.6-1.1-2.7 0-.9.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5c0-4-4-7.2-9-7.2zM7.5 12.5h.01M9.5 8h.01M14.5 8h.01" />,
  rapport2: <path d="M9 4h6v3H9zM7 5.5H5V21h14V5.5h-2M8.5 12l2 2 4-4M8.5 17.5h7" />,
  v2: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />,
  rapport3: <path d="M9 4h6v3H9zM7 5.5H5V21h14V5.5h-2M12 11v4M12 17.5v.01" />,
  meshy: <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" />,
  retouches: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 16.5l9 5 9-5" />,
  rendu: <path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" />,
  accord: <path d="M3 6h18v12H3zM3 10h18M7 15h4" />,
  impression: <path d="M7 9V3h10v6M7 17H4v-8h16v8h-3M7 14h10v7H7z" />,
  expedie: <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
};

export function StepIcon({ k }: { k: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICON[k]}
    </svg>
  );
}

const BADGE: Record<Step["state"], string> = { done: "✓", current: "", todo: "", error: "!", skip: "–" };


/** Trait entre deux blocs : vert si on est passé, animé s'il mène à l'étape en cours. */
function Wire({ from, to }: { from: Step; to: Step }) {
  const passed = from.state === "done" || from.state === "skip";
  const live = passed && (to.state === "current" || to.state === "error");
  return <span className={`wire ${live ? "live" : passed ? "passed" : ""}`} aria-hidden />;
}

const Tags = ({ items }: { items: string[] }) => (
  <span className="node-tags">
    {items.slice(0, 4).map((t, i) => (
      <i key={i}>{t}</i>
    ))}
  </span>
);

/** Ce qu'on voit dans le bloc pour une demande réelle. */
function Preview({ step, order }: { step: Step; order: Order }) {
  const { demande, base, rapport1, couleurs, rapport2, rapport3, pieces, fichiers } = order;
  if (step.state === "error") return <span className="node-err">{step.note}</span>;
  if (step.busy)
    return <span className="node-live">{step.key === "base" ? "Téléchargement du modèle…" : step.key === "meshy" ? `Meshy travaille… ${step.note ?? ""}` : "Claude regarde…"}</span>;
  switch (step.key) {
    case "base":
      if (base?.status === "done")
        return (
          <>
            <span className="node-ok">Modèle dans la commande</span>
            <span className="node-note">{base.label}</span>
          </>
        );
      return <span className="node-note">Se télécharge tout seul après l&apos;envoi.</span>;
    case "photos": {
      const shown = demande.files.slice(0, 4);
      const more = demande.files.length - shown.length;
      return (
        <span className="node-photos">
          {shown.map((f, i) => (
            <span key={f.pathname}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoSrc(f.pathname)} alt={f.slot} loading="lazy" />
              {i === shown.length - 1 && more > 0 && <b>+{more}</b>}
            </span>
          ))}
        </span>
      );
    }
    case "rapport1": {
      const r = rapport1?.result;
      if (!r) return <span className="node-note">Part tout seul quand le modèle est là et que la demande est ouverte.</span>;
      return (
        <>
          <span className="node-big">
            {r.differences.length} <small>différence{r.differences.length > 1 ? "s" : ""}</small>
          </span>
          <Tags items={r.differences.map((d) => d.ou)} />
          {!r.base_ok && <span className="node-err">Modèle de base à revoir</span>}
        </>
      );
    }
    case "couleurs":
      if (fichiers.couleurs) return <span className="node-ok">Refaites dans Blender</span>;
      if (couleurs?.result)
        return (
          <>
            <span className="node-big">
              {couleurs.applied?.length ?? 0} <small>matériau{(couleurs.applied?.length ?? 0) > 1 ? "x" : ""} repeint{(couleurs.applied?.length ?? 0) > 1 ? "s" : ""}</small>
            </span>
            {couleurs.result.limites.length > 0 && <span className="node-note">{couleurs.result.limites.length} limite(s) pour Blender</span>}
          </>
        );
      return <span className="node-note">Part tout seul après le 1er rapport.</span>;
    case "rapport2": {
      const r = rapport2?.result;
      if (!r) return <span className="node-note">Part tout seul quand la voiture est repeinte.</span>;
      return (
        <>
          <span className="node-big">
            {r.blender.length} <small>Blender</small> · {r.formes_3d.length} <small>forme{r.formes_3d.length > 1 ? "s" : ""} 3D</small>
          </span>
          <Tags items={r.formes_3d.map((f) => f.forme)} />
        </>
      );
    }
    case "v2":
      if (fichiers.v2) return <span className="node-ok">V2 déposée</span>;
      return <span className="node-note">{step.state === "current" ? "À faire : Claude corrige dans le chat." : HELP[step.key]}</span>;
    case "rapport3": {
      const r = rapport3?.result;
      if (!r) return <span className="node-note">Part tout seul quand la V2 est déposée.</span>;
      const ess = r.manques.filter((m) => m.importance === "essentiel").length;
      return (
        <>
          <span className="node-big">
            {ess} <small>essentiel{ess > 1 ? "s" : ""}</small> · {r.meshy.length} <small>Meshy</small>
          </span>
          <Tags items={r.meshy.map((m) => m.piece)} />
        </>
      );
    }
    case "meshy": {
      const done = pieces.jobs.find((j) => j.thumb);
      if (pieces.jobs.length)
        return (
          <>
            {done?.thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="node-thumb" src={photoSrc(done.thumb)} alt="Pièce Meshy" loading="lazy" />
            )}
            <span className="node-note">{step.note}</span>
          </>
        );
      if (step.state === "skip") return <span className="node-note">Rien d&apos;essentiel à générer.</span>;
      return <span className="node-note">{rapport3?.result ? "À toi : vérifie les recadrages et lance." : HELP[step.key]}</span>;
    }
    case "retouches":
      if (fichiers.final) return <span className="node-ok">Miniature déposée, à regarder</span>;
      return <span className="node-note">{step.state === "current" ? "À faire : Claude retouche dans le chat." : HELP[step.key]}</span>;
    default:
      if (step.state === "done") return <span className="node-ok">Fait le {day(step.date)}</span>;
      if (step.state === "current")
        return (
          <>
            <span className="node-todo">À faire maintenant</span>
            <span className="node-note">{HELP[step.key]}</span>
          </>
        );
      return <span className="node-note">{HELP[step.key]}</span>;
  }
}

type FlowProps = {
  steps: Step[];
  /** Demande réelle : les blocs montrent son contenu. Sans demande, ils expliquent l'étape. */
  order?: Order;
  selected?: string;
  onSelect?: (key: string) => void;
};

/** Le grand schéma : blocs reliés, défilant à l'horizontale. */
export function Flow({ steps, order, selected, onSelect }: FlowProps) {
  const ref = useRef<HTMLDivElement>(null);
  // À l'ouverture, on fait défiler le canevas jusqu'au bloc choisi (l'étape en cours).
  useEffect(() => {
    const c = ref.current;
    const n = c?.querySelector<HTMLElement>(".node.sel");
    if (c && n && c.scrollWidth > c.clientWidth) c.scrollLeft = n.offsetLeft - c.clientWidth / 2 + n.offsetWidth / 2;
  }, []);
  return (
    <div ref={ref} className={`flow-canvas ${order ? "" : "guide"}`}>
      <div className="flow">
        {steps.map((s, i) => (
          <div key={s.key} className="flow-cell">
            {i > 0 && <Wire from={steps[i - 1]} to={s} />}
            <button
              type="button"
              className={`node s-${s.state} t-${TONE[s.key]} ${s.busy ? "busy" : ""} ${selected === s.key ? "sel" : ""}`}
              onClick={onSelect ? () => onSelect(s.key) : undefined}
              disabled={!onSelect}
            >
              <span className="node-port in" />
              <span className="node-port out" />
              <span className="node-head">
                <span className="node-icon">
                  <StepIcon k={s.key} />
                </span>
                <span className="node-title">
                  <strong>{s.label}</strong>
                  <em>{s.who}</em>
                </span>
                {order && <span className="node-badge">{BADGE[s.state]}</span>}
              </span>
              <span className="node-body">
                {order ? <Preview step={s} order={order} /> : <span className="node-note">{HELP[s.key]}</span>}
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Version miniature pour la liste des demandes : les icônes reliées, colorées si l'étape est passée. */
export function FlowMini({ steps }: { steps: Step[] }) {
  return (
    <span className="flow-mini">
      {steps.map((s, i) => (
        <span key={s.key} className="fm-cell">
          {i > 0 && <Wire from={steps[i - 1]} to={s} />}
          <span className={`fm-node s-${s.state} t-${TONE[s.key]}`} title={`${s.label}${s.note ? ` : ${s.note}` : ""}`}>
            <StepIcon k={s.key} />
          </span>
        </span>
      ))}
    </span>
  );
}
