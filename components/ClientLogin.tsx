"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import { APERCU_PRIX, GOOGLE_LOGIN, TURNSTILE_SITE_KEY } from "@/lib/authShared";
import { authHeaders, supabase } from "@/lib/supabaseClient";

export type ClientStatus = { email: string; gratuit: boolean; credits: number; peutEnvoyer: boolean; jetable: boolean };

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void };
  }
}

/** Case anti-robot Cloudflare Turnstile ; le jeton part avec la demande de code, Supabase le vérifie. */
function Turnstile({ onToken }: { onToken: (t: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const draw = () => box.current && !box.current.childElementCount && window.turnstile?.render(box.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: onToken,
      "expired-callback": () => onToken(""),
      language: "fr",
    });
    if (window.turnstile) return void draw();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = draw;
    document.head.appendChild(s);
  }, [onToken]);
  return <div ref={box} className="turnstile" />;
}

/**
 * Étape « Ton compte » de l'envoi : connexion par code reçu par e-mail (on reste sur la page, les choix ne sont pas perdus)
 * ou par Google. Ensuite : 1er aperçu gratuit, les suivants à 5 € déduits de la miniature.
 */
export default function ClientLogin({ onReady }: { onReady: (s: ClientStatus) => void }) {
  const [status, setStatus] = useState<ClientStatus | null>(null);
  const [logged, setLogged] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const res = await fetch("/api/client", { headers: await authHeaders(), cache: "no-store" });
    if (res.status === 401) return setLogged(false);
    const d = await res.json();
    setLogged(true);
    setStatus(d);
  }

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => (data.session ? refresh() : setLogged(false)));
    const { data } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") refresh();
      if (event === "SIGNED_OUT") {
        setLogged(false);
        setStatus(null);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await f();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      const { error } = await supabase().auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true, ...(captcha ? { captchaToken: captcha } : {}) },
      });
      if (error) throw new Error(/rate|limit/i.test(error.message) ? "Trop de demandes : réessaie dans une minute." : error.message);
      setSent(true);
      track("Code de connexion demandé");
    });

  const checkCode = () =>
    run(async () => {
      const { error } = await supabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
      if (error) throw new Error("Code incorrect ou expiré.");
    });

  const google = () =>
    run(async () => {
      const { error } = await supabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } });
      if (error) throw new Error(error.message);
    });

  const pay = () =>
    run(async () => {
      const res = await fetch("/api/client/apercu", { method: "POST", headers: await authHeaders() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Paiement indisponible");
      track("Aperçu payant", {});
      window.location.href = d.checkoutUrl;
    });

  if (logged === null) return <p className="wz-tip">Chargement…</p>;

  if (logged && status) {
    return (
      <div className="contact">
        <div className="chosen">
          <span>
            Connecté : <b>{status.email}</b>
          </span>
          <button className="link" onClick={() => supabase().auth.signOut()}>
            Changer de compte
          </button>
        </div>
        {status.peutEnvoyer ? (
          <>
            <h2 className="wz-title">{status.gratuit ? "Ton aperçu 3D est offert." : "Ton aperçu payé est prêt à servir."}</h2>
            <p className="wz-tip">
              {status.gratuit
                ? "Un aperçu gratuit par personne : choisis bien ta voiture et soigne tes photos."
                : `Il te reste ${status.credits} aperçu${status.credits > 1 ? "s" : ""} payé${status.credits > 1 ? "s" : ""}. Les ${APERCU_PRIX} € seront déduits de ta miniature si tu la commandes.`}
            </p>
            <button className="cta full" onClick={() => onReady(status)}>
              Continuer
            </button>
          </>
        ) : (
          <>
            <h2 className="wz-title">{status.jetable ? "Pas d'aperçu gratuit avec cette adresse." : "Ton aperçu gratuit est déjà utilisé."}</h2>
            <p className="wz-tip">
              {status.jetable && "Les adresses e-mail jetables n'ont pas d'aperçu gratuit : utilise ta vraie adresse. "}
              Un nouvel aperçu coûte {APERCU_PRIX} €, déduits du prix de ta miniature si tu la commandes.
            </p>
            <button className="cta full" disabled={busy} onClick={pay}>
              {busy ? "Ouverture du paiement…" : `Payer ${APERCU_PRIX} € pour un nouvel aperçu`}
            </button>
            <button className="link back" disabled={busy} onClick={() => run(refresh)}>
              J'ai payé : actualiser
            </button>
          </>
        )}
        {error && <p className="notice err">{error}</p>}
      </div>
    );
  }

  return (
    <div className="contact">
      <h2 className="wz-title">Où t'envoyer ton aperçu 3D ?</h2>
      <p className="wz-tip">
        Ton premier aperçu est offert. On t'envoie un code par e-mail pour vérifier ton adresse : pas de mot de passe.
      </p>
      {GOOGLE_LOGIN && (
        <>
          <button className="cta ghost full" disabled={busy} onClick={google}>
            Continuer avec Google
          </button>
          <p className="or">ou</p>
        </>
      )}
      <div className="up-fields">
        <label>
          Ton e-mail
          <input
            type="email"
            autoComplete="email"
            placeholder="prenom@exemple.fr"
            value={email}
            disabled={sent}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {sent && (
          <label>
            Le code reçu par e-mail
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </label>
        )}
      </div>
      {!sent && TURNSTILE_SITE_KEY && <Turnstile onToken={setCaptcha} />}
      {sent ? (
        <>
          <button className="cta full" disabled={busy || code.length < 6} onClick={checkCode}>
            {busy ? "Vérification…" : "Valider le code"}
          </button>
          <button
            className="link back"
            disabled={busy}
            onClick={() => {
              setSent(false);
              setCode("");
            }}
          >
            Changer d'adresse ou renvoyer le code
          </button>
        </>
      ) : (
        <button
          className="cta full"
          disabled={busy || !/^\S+@\S+\.\S+$/.test(email) || Boolean(TURNSTILE_SITE_KEY && !captcha)}
          onClick={sendCode}
        >
          {busy ? "Envoi…" : "Recevoir mon code"}
        </button>
      )}
      {error && <p className="notice err">{error}</p>}
    </div>
  );
}
