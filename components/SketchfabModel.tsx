"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Configurator3D, { type ConfigModel } from "./Configurator3D";

type Info = {
  uid: string;
  name: string;
  author: string;
  authorUrl?: string;
  licence: string;
  viewerUrl: string;
  file: { url: string; zip: boolean; size: number };
};

/** Récupère le lien de téléchargement (temporaire) du modèle, puis ouvre le configurateur dessus. */
export default function SketchfabModel({ uid }: { uid: string }) {
  const [model, setModel] = useState<ConfigModel | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/sketchfab/model/${encodeURIComponent(uid)}`)
      .then(async (res) => {
        const d = (await res.json()) as Info & { error?: string };
        if (!res.ok || d.error) throw new Error(d.error ?? `erreur ${res.status}`);
        setModel({
          key: `sketchfab-${d.uid}`,
          name: d.name,
          subtitle: `${Math.max(1, Math.round(d.file.size / 1e6))} Mo`,
          url: d.file.url,
          zip: d.file.zip,
          credit: { name: d.name, author: d.author, authorUrl: d.authorUrl, licence: d.licence, viewerUrl: d.viewerUrl },
        });
      })
      .catch((e: Error) => setError(e.message));
  }, [uid]);

  if (error)
    return (
      <section className="garage">
        <h2>Ce modèle ne peut pas être chargé</h2>
        <p className="lead">{error}</p>
        <Link href="/configurer" className="cta">Choisir un autre modèle</Link>
      </section>
    );
  if (!model) return <section className="garage"><p className="lead">Préparation du modèle…</p></section>;
  return <Configurator3D model={model} />;
}
