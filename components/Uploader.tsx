"use client";

import { upload, uploadPresigned } from "@vercel/blob/client";
import { useEffect, useMemo, useRef, useState } from "react";
import AngleIcon from "./AngleIcon";
import CarPicker from "./CarPicker";
import type { Base } from "@/lib/catalog";
import { BLOB_ACCESS, type StorageMode } from "@/lib/storage";

// Ordre = un tour complet de la voiture. Les 4 faces nourrissent l'IA multi-vues ;
// les 3/4 servent à choisir les meilleures vues et à la retouche.
const ANGLES = [
  { id: "avant", label: "Face avant", tip: "Face à la voiture, centré sur le logo. Recule jusqu'à voir les deux rétroviseurs." },
  { id: "avant-gauche", label: "3/4 avant gauche", tip: "Place-toi à l'angle avant gauche, en diagonale. On doit voir la face avant et tout le côté conducteur." },
  { id: "gauche", label: "Côté gauche", tip: "Bien de profil côté conducteur, face au milieu de la voiture. Les deux roues entières dans le cadre." },
  { id: "arriere-gauche", label: "3/4 arrière gauche", tip: "Angle arrière gauche, en diagonale. Face arrière et côté conducteur visibles." },
  { id: "arriere", label: "Face arrière", tip: "Derrière la voiture, centré sur la plaque. Les deux feux dans le cadre." },
  { id: "arriere-droite", label: "3/4 arrière droit", tip: "Angle arrière droit, en diagonale. Face arrière et côté passager visibles." },
  { id: "droite", label: "Côté droit", tip: "Bien de profil côté passager, face au milieu de la voiture. Les deux roues entières dans le cadre." },
  { id: "avant-droite", label: "3/4 avant droit", tip: "Dernier angle : avant droit, en diagonale. Face avant et côté passager visibles." },
] as const;

type AngleId = (typeof ANGLES)[number]["id"];
type Phase = "idle" | "sending" | "done" | "error";

const DETAILS_STEP = ANGLES.length;
const CONTACT_STEP = ANGLES.length + 1;
const MAX_DETAILS = 4;
const TOUR_MS = 3000;

export default function Uploader() {
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<Partial<Record<AngleId, File>>>({});
  const [details, setDetails] = useState<File[]>([]);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [car, setCar] = useState("");
  // Étape 0 : la voiture de base, choisie avant les photos.
  const [base, setBase] = useState<Base | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [storage, setStorage] = useState<boolean | null>(null);
  const [mode, setMode] = useState<StorageMode | null>(null);
  const [justAdded, setJustAdded] = useState(false);
  const advance = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Visite guidée : tant que le client n'a rien touché, les angles défilent seuls (au premier clic, ça s'arrête).
  const [tour, setTour] = useState(true);
  const [visible, setVisible] = useState(false);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/storage")
      .then((r) => r.json())
      .then((d) => {
        setStorage(Boolean(d.enabled));
        setMode(d.mode ?? null);
      })
      .catch(() => setStorage(false));
    return () => clearTimeout(advance.current);
  }, []);

  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "-15% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!tour || !visible || !base) return;
    const t = setInterval(() => setStep((s) => (s + 1) % ANGLES.length), TOUR_MS);
    return () => clearInterval(t);
  }, [tour, visible, base]);

  const previews = useMemo(() => {
    const m: Partial<Record<AngleId, string>> = {};
    for (const [k, f] of Object.entries(photos)) if (f) m[k as AngleId] = URL.createObjectURL(f);
    return m;
  }, [photos]);
  const detailPreviews = useMemo(() => details.map((f) => URL.createObjectURL(f)), [details]);

  const done = ANGLES.filter((a) => photos[a.id]).length;
  const allPhotos = done === ANGLES.length;
  const firstMissing = ANGLES.findIndex((a) => !photos[a.id]);
  const emailOk = /^\S+@\S+\.\S+$/.test(email);

  function addPhoto(id: AngleId, file: File) {
    const next = { ...photos, [id]: file };
    setPhotos(next);
    setJustAdded(true);
    clearTimeout(advance.current);
    // Laisse voir la photo un instant, puis passe à l'angle suivant encore vide.
    advance.current = setTimeout(() => {
      setJustAdded(false);
      const missing = ANGLES.findIndex((a) => !next[a.id]);
      setStep(missing === -1 ? DETAILS_STEP : missing);
    }, 900);
  }

  async function send() {
    setPhase("sending");
    setError("");
    setProgress(0);
    const files = [
      ...ANGLES.map((a) => ({ slot: a.id as string, file: photos[a.id]! })),
      ...details.map((file, i) => ({ slot: `detail-${i + 1}`, file })),
    ];
    const id = `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}`;

    try {
      if (!storage) {
        // Mode démo : pas de stockage branché, on simule l'envoi.
        for (let p = 0; p <= 100; p += 20) {
          setProgress(p);
          await new Promise((r) => setTimeout(r, 120));
        }
        setPhase("done");
        return;
      }

      const total = files.reduce((s, f) => s + f.file.size, 0);
      const loaded: Record<string, number> = {};
      const uploaded = await Promise.all(
        files.map(async ({ slot, file }) => {
          const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
          // Connexion Blob actuelle (OIDC) : envoi par URL présignée, en une seule requête.
          const send = mode === "oidc" ? uploadPresigned : upload;
          const blob = await send(`submissions/${id}/${slot}.${ext}`, file, {
            access: BLOB_ACCESS,
            handleUploadUrl: "/api/upload",
            multipart: mode === "token" && file.size > 20 * 1024 * 1024,
            onUploadProgress: (e) => {
              loaded[slot] = e.loaded;
              const sum = Object.values(loaded).reduce((a, b) => a + b, 0);
              setProgress(Math.min(99, Math.round((sum / total) * 100)));
            },
          });
          return { slot, url: blob.url, pathname: blob.pathname };
        })
      );

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, email, car, base, mode: "photos", files: uploaded }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Envoi refusé");
      setProgress(100);
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  if (phase === "done") {
    return (
      <div className="up-card up-done">
        <div className="done-mark">✓</div>
        <h2>Ta voiture est entre de bonnes mains.</h2>
        <p>
          On modélise ta {car || "voiture"} et on t'écrit à <b>{email}</b> dès que ton modèle 3D est prêt à
          personnaliser.
        </p>
        {storage === false && (
          <p className="notice">Mode démo : le stockage n'est pas encore branché, aucun fichier n'a été envoyé.</p>
        )}
        <a className="cta ghost" href="/configurer">
          Découvrir les options
        </a>
      </div>
    );
  }

  if (!base) {
    return (
      <div className="up-card wizard">
        <CarPicker
          onPick={(b) => {
            setBase(b);
            setCar(b.label);
            setStep(0);
          }}
        />
      </div>
    );
  }

  const angle = step < ANGLES.length ? ANGLES[step] : null;

  return (
    <div
      className="up-card wizard"
      ref={card}
      onPointerDown={() => setTour(false)}
      onKeyDown={() => setTour(false)}
    >
      <div className="pk-chosen">
        <span>
          Ta voiture : <b>{base.label}</b>
        </span>
        <button className="link" onClick={() => setBase(null)}>
          Changer
        </button>
      </div>
      <div className="wz-head">
        <span>
          {angle ? `Photo ${step + 1} sur ${ANGLES.length}` : step === DETAILS_STEP ? "Détails" : "Dernière étape"}
        </span>
        <span className="wz-count">{done}/{ANGLES.length}</span>
      </div>
      <div className="segments" aria-hidden>
        {ANGLES.map((a, i) => (
          <i key={a.id} className={photos[a.id] ? "ok" : i === step ? "cur" : ""} />
        ))}
      </div>

      {angle && (
        <>
          <div className="frame">
            {previews[angle.id] ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="frame-photo" src={previews[angle.id]} alt={`Ta photo : ${angle.label}`} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="frame-inset" src={`/guide/${angle.id}.jpg`} alt="" />
                {justAdded && <div className="frame-ok">✓</div>}
              </>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="frame-guide" src={`/guide/${angle.id}.jpg`} alt={`Exemple : ${angle.label}`} />
                <div className="frame-map">
                  <AngleIcon angle={angle.id} />
                </div>
              </>
            )}
          </div>

          <h2 className="wz-title">{angle.label}</h2>
          <p className="wz-tip">{angle.tip}</p>

          <label className="cta full file-btn">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) addPhoto(angle.id, f);
                e.target.value = "";
              }}
            />
            {photos[angle.id] ? "Reprendre cette photo" : "Ajouter la photo"}
          </label>
        </>
      )}

      {step === DETAILS_STEP && (
        <>
          <h2 className="wz-title">Des détails à nous montrer ?</h2>
          <p className="wz-tip">
            Jantes, aileron, logos, kit carrosserie… Jusqu'à {MAX_DETAILS} photos. Facultatif.
          </p>
          <div className="detail-grid">
            {Array.from({ length: MAX_DETAILS }).map((_, i) => (
              <label key={i} className={`detail ${details[i] ? "filled" : ""}`}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setDetails((d) => [...d.slice(0, i), f, ...d.slice(i + 1)].filter(Boolean));
                    e.target.value = "";
                  }}
                />
                {details[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={detailPreviews[i]} alt="" />
                ) : (
                  <span>+</span>
                )}
              </label>
            ))}
          </div>
          <button className="cta full" onClick={() => setStep(CONTACT_STEP)}>
            {details.length ? "Continuer" : "Passer cette étape"}
          </button>
        </>
      )}

      {step === CONTACT_STEP && (
        <>
          <h2 className="wz-title">On te prévient où ?</h2>
          <p className="wz-tip">On t'écrit dès que ton modèle 3D est prêt à personnaliser.</p>
          <div className="up-fields">
            <input placeholder="Ta voiture (ex. Golf 8 GTI 2021)" value={car} onChange={(e) => setCar(e.target.value)} />
            <input type="email" placeholder="Ton email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <label className="consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              J'accepte que mes photos servent à modéliser ma voiture (voir la{" "}
              <a href="/confidentialite" target="_blank">politique de confidentialité</a>).
            </span>
          </label>
          <button className="cta full" disabled={!allPhotos || !emailOk || !consent || phase === "sending"} onClick={send}>
            {phase === "sending" ? `Envoi… ${progress} %` : "Envoyer ma voiture"}
          </button>
          {phase === "sending" && (
            <div className="bar">
              <div style={{ width: `${progress}%` }} />
            </div>
          )}
          {!allPhotos && (
            <p className="notice">
              Il manque {ANGLES.length - done} photo(s).{" "}
              <button className="link" onClick={() => setStep(firstMissing)}>
                Compléter
              </button>
            </p>
          )}
          {phase === "error" && <p className="notice err">{error}</p>}
        </>
      )}

      <div className="thumbs-nav">
        {ANGLES.map((a, i) => (
          <button
            key={a.id}
            className={`tn ${i === step ? "cur" : ""} ${photos[a.id] ? "ok" : ""}`}
            onClick={() => setStep(i)}
            title={a.label}
            aria-label={a.label}
          >
            {previews[a.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previews[a.id]} alt="" />
            ) : (
              <AngleIcon angle={a.id} />
            )}
          </button>
        ))}
      </div>
      <div className="wz-nav">
        <button className="link" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          ← Précédent
        </button>
        {step < CONTACT_STEP && (
          <button
            className="link"
            disabled={step < ANGLES.length && !photos[ANGLES[step].id]}
            onClick={() => setStep((s) => s + 1)}
          >
            Suivant →
          </button>
        )}
      </div>
      <p className="up-foot">Tes photos servent uniquement à modéliser ta voiture.</p>
    </div>
  );
}
