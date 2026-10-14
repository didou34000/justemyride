"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useMemo, useState } from "react";
import AngleIcon from "./AngleIcon";
import { BLOB_ACCESS } from "@/lib/storage";

const SLOTS = [
  { id: "avant", label: "Face avant" },
  { id: "gauche", label: "Côté gauche" },
  { id: "arriere", label: "Face arrière" },
  { id: "droite", label: "Côté droit" },
] as const;

type SlotId = (typeof SLOTS)[number]["id"];
type Mode = "photos" | "video";
type Phase = "idle" | "sending" | "done" | "error";

const MAX_EXTRAS = 8;

export default function Uploader() {
  const [mode, setMode] = useState<Mode>("photos");
  const [slots, setSlots] = useState<Partial<Record<SlotId, File>>>({});
  const [extras, setExtras] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [email, setEmail] = useState("");
  const [car, setCar] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [storage, setStorage] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/storage")
      .then((r) => r.json())
      .then((d) => setStorage(Boolean(d.enabled)))
      .catch(() => setStorage(false));
  }, []);

  const previews = useMemo(() => {
    const m: Record<string, string> = {};
    for (const [k, f] of Object.entries(slots)) if (f) m[k] = URL.createObjectURL(f);
    return m;
  }, [slots]);

  const filled = SLOTS.filter((s) => slots[s.id]).length;
  const filesReady = mode === "photos" ? filled === SLOTS.length : Boolean(video);
  const emailOk = /^\S+@\S+\.\S+$/.test(email);
  const canSend = filesReady && emailOk && phase !== "sending";

  function toSend(): { slot: string; file: File }[] {
    if (mode === "video") return video ? [{ slot: "video", file: video }] : [];
    return [
      ...SLOTS.flatMap((s) => (slots[s.id] ? [{ slot: s.id, file: slots[s.id]! }] : [])),
      ...extras.map((file, i) => ({ slot: `detail-${i + 1}`, file })),
    ];
  }

  async function send() {
    setPhase("sending");
    setError("");
    setProgress(0);
    const files = toSend();
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
          const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
          const blob = await upload(`submissions/${id}/${slot}.${ext}`, file, {
            access: BLOB_ACCESS,
            handleUploadUrl: "/api/upload",
            multipart: file.size > 20 * 1024 * 1024,
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
        body: JSON.stringify({ id, email, car, mode, files: uploaded }),
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

  return (
    <div className="up-card" id="deposer">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === "photos"} className={mode === "photos" ? "on" : ""} onClick={() => setMode("photos")}>
          Photos <span className="tag">Recommandé</span>
        </button>
        <button role="tab" aria-selected={mode === "video"} className={mode === "video" ? "on" : ""} onClick={() => setMode("video")}>
          Vidéo
        </button>
      </div>

      {mode === "photos" ? (
        <>
          <p className="up-lead">
            4 photos nettes, une par côté. C'est ce qui donne le modèle le plus fidèle.
          </p>
          <div className="slots">
            {SLOTS.map((s) => (
              <label key={s.id} className={`slot ${slots[s.id] ? "filled" : ""}`}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setSlots((p) => ({ ...p, [s.id]: f }));
                  }}
                />
                {previews[s.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previews[s.id]} alt={s.label} />
                ) : (
                  <AngleIcon angle={s.id} />
                )}
                <span>{s.label}</span>
              </label>
            ))}
          </div>
          <label className="extras">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setExtras(Array.from(e.target.files ?? []).slice(0, MAX_EXTRAS))}
            />
            <span>
              {extras.length
                ? `${extras.length} photo(s) de détail ajoutée(s)`
                : "+ Photos de détail (3/4, jantes, aileron, logos…) — facultatif"}
            </span>
          </label>
        </>
      ) : (
        <>
          <p className="up-lead">
            Un tour complet et lent de la voiture, 30 à 60 secondes. Plus simple, un peu moins précis.
          </p>
          <label className={`video-drop ${video ? "filled" : ""}`}>
            <input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} />
            <svg viewBox="0 0 24 24" aria-hidden>
              <rect x="2.5" y="6" width="13" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M15.5 10.5 L21.5 7 V17 L15.5 13.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <strong>{video ? video.name : "Choisir une vidéo"}</strong>
            <span>{video ? `${(video.size / 1024 / 1024).toFixed(0)} Mo` : "MP4 ou MOV, 500 Mo max"}</span>
          </label>
        </>
      )}

      <div className="up-fields">
        <input placeholder="Ta voiture (ex. Golf 8 GTI 2021)" value={car} onChange={(e) => setCar(e.target.value)} />
        <input type="email" placeholder="Ton email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <button className="cta full" disabled={!canSend} onClick={send}>
        {phase === "sending" ? `Envoi… ${progress} %` : "Envoyer ma voiture"}
      </button>
      {phase === "sending" && (
        <div className="bar">
          <div style={{ width: `${progress}%` }} />
        </div>
      )}
      <p className="up-foot">
        {mode === "photos" && filled < SLOTS.length ? `${filled}/4 photos · ` : ""}
        Tes fichiers servent uniquement à modéliser ta voiture.
      </p>
      {phase === "error" && <p className="notice err">{error}</p>}
    </div>
  );
}
