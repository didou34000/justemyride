"use client";

import { useEffect, useMemo, useState } from "react";
import CarPicker from "./CarPicker";
import ClientLogin, { type ClientStatus } from "./ClientLogin";
import type { Base } from "@/lib/catalog";
import { track } from "@vercel/analytics";
import type { StorageMode } from "@/lib/storage";
import { sendFile } from "@/lib/uploadClient";
import { authConfigured } from "@/lib/authShared";
import { authHeaders } from "@/lib/supabaseClient";

/*
 * Envoi d'une voiture en 3 étapes : la voiture, les photos (6 vues guidées, puis autant qu'on veut), le contact.
 * Quand la connexion client est branchée, une étape « Ton compte » passe avant (1 aperçu gratuit par personne).
 * Les noms des fichiers (« avant », « avant-gauche », « gauche », « droite », « arriere-droite », « arriere », « photo-N »)
 * sont lus par l'admin et par les rapports de Claude.
 */
const REQUIRED = [
  { id: "avant", label: "Face avant", tip: "Bien en face, au milieu : la calandre, les phares, le pare-chocs." },
  { id: "avant-gauche", label: "3/4 avant", tip: "À l'angle avant, en diagonale : la face avant et tout un côté." },
  { id: "gauche", label: "Côté gauche", tip: "De profil, bien perpendiculaire : on voit la hauteur de caisse et les jantes." },
  { id: "droite", label: "Côté droit", tip: "L'autre profil, de la même façon." },
  { id: "arriere-droite", label: "3/4 arrière", tip: "À l'angle arrière, en diagonale : la face arrière et un côté." },
  { id: "arriere", label: "Face arrière", tip: "Bien en face, au milieu : les feux, l'échappement, le diffuseur." },
] as const;
// Pas de vraie limite pour le client : seulement un garde-fou contre un envoi par erreur de toute une galerie.
const MAX_EXTRA = 78;
const PARALLEL = 4;

type ReqId = (typeof REQUIRED)[number]["id"];
type Step = "compte" | "car" | "photos" | "contact";
type Phase = "idle" | "sending" | "done" | "error";

/**
 * Réduit une photo avant l'envoi (2560 px de côté au plus, JPEG) : 1 à 2 Mo au lieu de 5 à 15, largement assez pour l'analyse
 * et les recadrages. Si le navigateur ne sait pas la lire (HEIC hors Safari), on envoie l'original.
 */
async function shrinkPhoto(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.type === "image/jpeg" && file.size < 3e6) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

const isImage = (f: File) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name);

/** `size` : la taille choisie sur la fiche produit, gardée avec la demande (le client peut encore la changer à la commande). */
/** `config` : les choix faits dans le configurateur 3D, s'il en vient (jantes, couleur…), joints à la demande. */
export default function Uploader({ size, config }: { size?: string; config?: Record<string, unknown> | null } = {}) {
  const auth = authConfigured();
  const [step, setStep] = useState<Step>(auth ? "compte" : "car");
  const [account, setAccount] = useState<ClientStatus | null>(null);
  const [base, setBase] = useState<Base | null>(null);
  const [car, setCar] = useState("");
  const [req, setReq] = useState<Partial<Record<ReqId, File>>>({});
  const [extra, setExtra] = useState<File[]>([]);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [storage, setStorage] = useState<boolean | null>(null);
  const [mode, setMode] = useState<StorageMode | null>(null);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    fetch("/api/storage")
      .then((r) => r.json())
      .then((d) => {
        setStorage(Boolean(d.enabled));
        setMode(d.mode ?? null);
      })
      .catch(() => setStorage(false));
  }, []);

  const reqPreview = useMemo(() => {
    const m: Partial<Record<ReqId, string>> = {};
    for (const [k, f] of Object.entries(req)) if (f) m[k as ReqId] = URL.createObjectURL(f);
    return m;
  }, [req]);
  const extraPreview = useMemo(() => extra.map((f) => URL.createObjectURL(f)), [extra]);

  const reqDone = REQUIRED.every((r) => req[r.id]);
  const total = REQUIRED.filter((r) => req[r.id]).length + extra.length;
  const emailOk = /^\S+@\S+\.\S+$/.test(email);

  /** Plusieurs photos d'un coup : elles remplissent d'abord les 6 vues (à partir de `first`), puis les photos en plus. */
  function addFiles(list: FileList | File[], first?: ReqId) {
    const files = Array.from(list).filter(isImage);
    if (!files.length) return;
    const nextReq = { ...req };
    const order = first ? [first, ...REQUIRED.map((r) => r.id).filter((id) => id !== first)] : REQUIRED.map((r) => r.id);
    const rest: File[] = [];
    files.forEach((f, i) => {
      const slot = i === 0 && first ? first : order.find((id) => !nextReq[id]);
      if (slot && (i === 0 && first ? true : !nextReq[slot])) nextReq[slot] = f;
      else rest.push(f);
    });
    setReq(nextReq);
    if (rest.length) setExtra((e) => [...e, ...rest].slice(0, MAX_EXTRA));
  }

  async function send() {
    setPhase("sending");
    setError("");
    setProgress(0);
    const files = await Promise.all(
      [
        ...REQUIRED.map((r) => ({ slot: r.id as string, file: req[r.id]! })),
        ...extra.map((file, i) => ({ slot: `photo-${i + 1}`, file })),
      ].map(async ({ slot, file }) => ({ slot, file: await shrinkPhoto(file) }))
    );
    const id = `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}`;

    try {
      if (storage === false) {
        // Mode démo : pas de stockage branché, on simule l'envoi.
        for (let p = 0; p <= 100; p += 20) {
          setProgress(p);
          await new Promise((r) => setTimeout(r, 120));
        }
        setPhase("done");
        return;
      }

      const totalBytes = files.reduce((s, f) => s + f.file.size, 0);
      const loaded: Record<string, number> = {};
      // Envoi par lots de PARALLEL photos : un client peut en mettre des dizaines.
      const uploaded: { slot: string; pathname: string }[] = [];
      const headers = auth ? await authHeaders() : {};
      let next = 0;
      async function worker() {
        while (next < files.length) {
          const { slot, file } = files[next++];
          const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
          const blob = await sendFile(`submissions/${id}/${slot}.${ext}`, file, {
            mode: mode!,
            handleUploadUrl: "/api/upload",
            headers,
            onProgress: (n) => {
              loaded[slot] = n;
              const sum = Object.values(loaded).reduce((a, b) => a + b, 0);
              setProgress(Math.min(99, Math.round((sum / totalBytes) * 100)));
            },
          });
          uploaded.push({ slot, pathname: blob.pathname });
        }
      }
      await Promise.all(Array.from({ length: Math.min(PARALLEL, files.length) }, worker));

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ id, email, car, base, size, ...(config ? { config } : {}), mode: "photos", files: uploaded }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Envoi refusé");
      track("Photos envoyées", { photos: files.length });
      setProgress(100);
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  if (phase === "done") {
    return (
      <div className="flow-card done">
        <div className="done-mark" aria-hidden>
          ✓
        </div>
        <h2>C'est envoyé.</h2>
        <p>
          On modélise ta {car || "voiture"} et on t'écrit à <b>{email}</b> dès que ton aperçu 3D est prêt. Tu pourras
          alors choisir la taille et les options, puis commander.
        </p>
        {storage === false && (
          <p className="notice">Mode démo : le stockage n'est pas encore branché, aucun fichier n'a été envoyé.</p>
        )}
        <a className="cta ghost" href="/">
          Retour à l'accueil
        </a>
      </div>
    );
  }

  const steps: { id: Step; label: string }[] = [
    ...(auth ? [{ id: "compte" as Step, label: "Ton compte" }] : []),
    { id: "car", label: "Ta voiture" },
    { id: "photos", label: "Tes photos" },
    { id: "contact", label: auth ? "Envoi" : "Ton e-mail" },
  ];
  const cur = steps.findIndex((s) => s.id === step);

  return (
    <div className="flow-card">
      <ol className="flow-steps" aria-label="Étapes">
        {steps.map((s, i) => (
          <li key={s.id} className={i < cur ? "done" : i === cur ? "cur" : ""} aria-current={i === cur ? "step" : undefined}>
            <span>{i < cur ? "✓" : i + 1}</span>
            {s.label}
          </li>
        ))}
      </ol>

      {step === "compte" && (
        <ClientLogin
          onReady={(st) => {
            setAccount(st);
            setEmail(st.email);
            setStep("car");
          }}
        />
      )}

      {step === "car" && (
        <CarPicker
          onPick={(b) => {
            setBase(b);
            setCar(b.label);
            setStep("photos");
            track("Voiture choisie", { source: b.source ?? "catalogue" });
          }}
        />
      )}

      {step === "photos" && (
        <div
          className={`photos ${drag ? "drag" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={(e) => e.currentTarget === e.target && setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <div className="chosen">
            <span>
              <b>{base?.label}</b>
            </span>
            <button className="link" onClick={() => setStep("car")}>
              Changer
            </button>
          </div>
          <h2 className="wz-title">Les photos de ta voiture</h2>
          <p className="wz-tip">
            6 vues autour de la voiture, puis autant de photos en plus que tu veux (jantes, détails modifiés) : plus il y en a, plus ta miniature est fidèle. Sur ordinateur, glisse-les toutes d'un coup.
          </p>

          <div className="req-grid">
            {REQUIRED.map((r) => (
              <label key={r.id} className={`slot ${req[r.id] ? "filled" : ""}`}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files, r.id);
                    e.target.value = "";
                  }}
                />
                <span className="slot-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={reqPreview[r.id] ?? `/guide/${r.id}.jpg`} alt={req[r.id] ? `Ta photo : ${r.label}` : `Exemple : ${r.label}`} />
                  {!req[r.id] && <em>Exemple</em>}
                </span>
                <span className="slot-body">
                  <b>
                    {r.label} {req[r.id] && <i className="ok">✓</i>}
                  </b>
                  <small>{r.tip}</small>
                  <span className="slot-btn">{req[r.id] ? "Changer la photo" : "Ajouter"}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="extra">
            <div className="extra-head">
              <b>Toutes les autres photos{extra.length ? ` (${extra.length})` : ""}</b>
              <span>Jantes, gros plans des modifs (kit, aileron, autocollants), logos… Mets-en autant que tu veux.</span>
            </div>
            <div className="extra-grid">
              {extra.map((f, i) => (
                <div key={i} className="thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={extraPreview[i]} alt={`Photo en plus ${i + 1}`} />
                  <button aria-label="Retirer cette photo" onClick={() => setExtra((e) => e.filter((_, j) => j !== i))}>
                    ×
                  </button>
                </div>
              ))}
              {extra.length < MAX_EXTRA && (
                <label className="thumb add">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) setExtra((x) => [...x, ...Array.from(e.target.files!).filter(isImage)].slice(0, MAX_EXTRA));
                      e.target.value = "";
                    }}
                  />
                  <span>+</span>
                </label>
              )}
            </div>
          </div>

          <button className="cta full" disabled={!reqDone} onClick={() => setStep("contact")}>
            {reqDone ? `Continuer avec ${total} photo${total > 1 ? "s" : ""}` : "Ajoute au moins le 3/4 avant et le 3/4 arrière"}
          </button>
        </div>
      )}

      {step === "contact" && (
        <div className="contact">
          <h2 className="wz-title">{account ? "Dernière étape" : "Où t'envoyer ton aperçu 3D ?"}</h2>
          <p className="wz-tip">On t'écrit dès qu'il est prêt.</p>
          <div className="up-fields">
            <label>
              Ta voiture
              <input placeholder="Ex. Golf 8 GTI 2021" value={car} onChange={(e) => setCar(e.target.value)} />
            </label>
            <label>
              Ton e-mail
              <input type="email" autoComplete="email" placeholder="prenom@exemple.fr" value={email} readOnly={Boolean(account)} onChange={(e) => setEmail(e.target.value)} />
            </label>
          </div>
          <label className="consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              J'accepte que mes photos servent à modéliser ma voiture (voir la{" "}
              <a href="/confidentialite" target="_blank">
                politique de confidentialité
              </a>
              ).
            </span>
          </label>
          <button className="cta full" disabled={!reqDone || !emailOk || !consent || storage === null || (auth && !account) || phase === "sending"} onClick={send}>
            {phase === "sending" ? `Envoi… ${progress} %` : "Envoyer ma voiture"}
          </button>
          {phase === "sending" && (
            <div className="bar">
              <div style={{ width: `${progress}%` }} />
            </div>
          )}
          {phase === "error" && <p className="notice err">{error}</p>}
          <button className="link back" onClick={() => setStep("photos")}>
            ← Revenir aux photos ({total})
          </button>
        </div>
      )}
    </div>
  );
}
