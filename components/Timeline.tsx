import type { Step } from "@/lib/steps";

const date = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

const MARK: Record<Step["state"], string> = { done: "✓", current: "•", todo: "", error: "!", skip: "–" };

/** La frise d'une commande : une pastille par étape, reliées par un trait. compact = version courte pour la liste. */
export default function Timeline({ steps, compact = false }: { steps: Step[]; compact?: boolean }) {
  return (
    <ol className={`frise ${compact ? "compact" : ""}`}>
      {steps.map((s) => (
        <li key={s.key} className={`frise-step ${s.state}`} title={`${s.label}${s.note ? ` : ${s.note}` : ""}`}>
          <span className="frise-dot">{MARK[s.state]}</span>
          {!compact && (
            <span className="frise-text">
              <strong>{s.label}</strong>
              <em>{s.who}</em>
              {(s.date || s.note) && (
                <small>
                  {date(s.date)}
                  {s.date && s.note ? " · " : ""}
                  {s.note}
                </small>
              )}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
