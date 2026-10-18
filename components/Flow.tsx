"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { STEPS, type Step, type Tone } from "@/lib/steps";
import type { Order } from "@/lib/orders";
import { photoSrc } from "@/lib/photo";

/**
 * Le circuit d'une commande en blocs reliés, façon n8n : un bloc par étape,
 * coloré selon qui agit, avec ce qu'il contient (photos, point de Claude, Meshy…).
 */

const TONE = Object.fromEntries(STEPS.map((s) => [s.key, s.tone])) as Record<string, Tone>;
const HELP = Object.fromEntries(STEPS.map((s) => [s.key, s.help])) as Record<string, string>;

const day = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

const ICON: Record<string, ReactNode> = {
  photos: <path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
  analyse: <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z" />,
  valide: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.7 2.7L16.5 9.5" />,
  pieces: <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" />,
  details: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5M8.5 11h5M11 8.5v5" />,
  logos: <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8-4.3-4.1 5.9-.9z" />,
  meshy_logos: <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM9 12.5l2 2 4-4" />,
  assemblage: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 16.5l9 5 9-5" />,
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

/** Ce qu'on voit dans le bloc pour une demande réelle. */
function Preview({ step, order }: { step: Step; order: Order }) {
  const { demande, analyse, meshy, details, meshyLogos, fichiers } = order;
  const r = analyse?.result;
  switch (step.key) {
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
    case "analyse":
      if (step.state === "error") return <span className="node-err">{analyse?.error ?? step.note}</span>;
      if (step.busy) return <span className="node-live">Claude regarde les photos…</span>;
      if (r)
        return (
          <>
            <span className="node-big">
              {r.differences.length} <small>différence{r.differences.length > 1 ? "s" : ""}</small>
            </span>
            <span className="node-tags">
              {r.differences.slice(0, 4).map((d, i) => (
                <i key={i}>{d.piece}</i>
              ))}
            </span>
            {!r.base_ok && <span className="node-err">Base à revoir</span>}
          </>
        );
      return <span className="node-note">Part tout seul après l&apos;envoi des photos.</span>;
    case "pieces": {
      const todo = r?.differences.filter((d) => d.traitement === "piece_3d") ?? [];
      if (meshy?.glb || meshy?.status === "SUCCEEDED")
        return (
          <>
            {meshy.thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="node-thumb" src={photoSrc(meshy.thumb)} alt="Rendu Meshy" loading="lazy" />
            )}
            <span className="node-ok">Modèle 3D reçu</span>
          </>
        );
      if (meshy && step.state === "error") return <span className="node-err">{meshy.error ?? meshy.status}</span>;
      if (meshy)
        return (
          <>
            <span className="node-live">Meshy travaille… {meshy.progress ?? 0} %</span>
            <span className="node-bar">
              <i style={{ width: `${meshy.progress ?? 4}%` }} />
            </span>
          </>
        );
      if (step.state === "skip") return <span className="node-note">Rien à modéliser : peinture et décalques seulement.</span>;
      if (todo.length)
        return (
          <>
            <span className="node-big">
              {todo.length} <small>pièce{todo.length > 1 ? "s" : ""} à faire</small>
            </span>
            <span className="node-tags">
              {todo.slice(0, 4).map((d, i) => (
                <i key={i}>{d.piece}</i>
              ))}
            </span>
          </>
        );
      return <span className="node-note">{HELP[step.key]}</span>;
    }
    case "details": {
      const x = details?.result;
      if (step.state === "error") return <span className="node-err">{details?.error ?? step.note}</span>;
      if (step.busy) return <span className="node-live">Claude cherche les détails…</span>;
      if (x)
        return (
          <>
            <span className="node-big">
              {x.manques.length} <small>détail{x.manques.length > 1 ? "s" : ""} manquant{x.manques.length > 1 ? "s" : ""}</small>
            </span>
            <span className="node-tags">
              {x.manques.slice(0, 4).map((d, i) => (
                <i key={i}>{d.detail}</i>
              ))}
            </span>
          </>
        );
      if (step.state === "skip") return <span className="node-note">Pas de modèle Meshy à contrôler.</span>;
      return <span className="node-note">{meshy?.glb ? "Part tout seul à l'ouverture de la demande." : HELP[step.key]}</span>;
    }
    case "logos": {
      const badges = details?.result?.manques.filter((b) => b.type === "logo_marque" || b.type === "badge_texte") ?? [];
      if (fichiers.logos)
        return (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="node-thumb wide" src={photoSrc(fichiers.logos)} alt="Image des logos" loading="lazy" />
            <span className="node-ok">Image déposée</span>
          </>
        );
      if (step.state === "skip") return <span className="node-note">Aucun badge à refaire.</span>;
      if (badges.length)
        return (
          <>
            <span className="node-big">
              {badges.length} <small>badge{badges.length > 1 ? "s" : ""}</small>
            </span>
            <span className="node-tags">
              {badges.slice(0, 3).map((b, i) => (
                <i key={i}>{b.detail}</i>
              ))}
            </span>
          </>
        );
      return <span className="node-note">{HELP[step.key]}</span>;
    }
    case "meshy_logos":
      if (meshyLogos?.glb || meshyLogos?.status === "SUCCEEDED")
        return (
          <>
            {meshyLogos.thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="node-thumb" src={photoSrc(meshyLogos.thumb)} alt="Logos Meshy" loading="lazy" />
            )}
            <span className="node-ok">Logos 3D reçus</span>
          </>
        );
      if (meshyLogos && step.state === "error") return <span className="node-err">{meshyLogos.error ?? meshyLogos.status}</span>;
      if (meshyLogos)
        return (
          <>
            <span className="node-live">Meshy travaille… {meshyLogos.progress ?? 0} %</span>
            <span className="node-bar">
              <i style={{ width: `${meshyLogos.progress ?? 4}%` }} />
            </span>
          </>
        );
      if (step.state === "skip") return <span className="node-note">Pas de logos à générer.</span>;
      return <span className="node-note">{fichiers.logos ? "Image prête : à lancer." : "Attend l'image des logos."}</span>;
    case "assemblage":
      if (fichiers.final) return <span className="node-ok">Miniature déposée, à regarder</span>;
      if (step.state === "done") return <span className="node-ok">Fait le {day(step.date)}</span>;
      return <span className="node-note">{step.state === "current" ? "À faire : Claude assemble dans le chat." : HELP[step.key]}</span>;
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
