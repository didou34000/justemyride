"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import Uploader from "./Uploader";
import { accessories, CONFIG_KEY, sizes } from "@/lib/options";

/*
 * Fiche produit : galerie à gauche, choix à droite, puis l'envoi des photos juste en dessous.
 * Les images sont des rendus 3D en attendant les photos d'une vraie miniature : la légende le dit.
 */
const GALLERY = [
  { src: "/shop/v2/socle-blanc.jpg", w: 1600, h: 1600, alt: "Rendu 3D d'une miniature de BMW M140i bleue sur son socle blanc", cap: "Rendu 3D · socle blanc inclus" },
  { src: "/cars/bmw-m140i.jpg", w: 900, h: 450, alt: "Aperçu 3D d'une BMW M140i bleue", cap: "L'aperçu 3D que tu reçois avant de payer" },
  { src: "/shop/v2/socle-noir.jpg", w: 1600, h: 1600, alt: "Rendu 3D d'une miniature sur socle noir gravé", cap: "Option : socle noir gravé" },
  { src: "/shop/v2/vitrine.jpg", w: 1600, h: 1600, alt: "Rendu 3D d'une miniature sous vitrine acrylique", cap: "Option : vitrine acrylique" },
  { src: "/hero/photo.jpg", w: 1672, h: 941, alt: "Un conducteur photographie sa voiture avec son téléphone", cap: "Il suffit de photos prises au téléphone" },
];

function Check() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
      <path d="M5 10.3l3.2 3.2L15 6.7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ProductPage({ demo, lead }: { demo?: string; lead: string }) {
  const [img, setImg] = useState(0);
  const [size, setSize] = useState("1-24");
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  // Arrivée depuis le configurateur : on reprend la taille (?taille=) et ses choix, joints à la demande.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("taille");
    if (t && sizes.some((x) => x.id === t)) setSize(t);
    try {
      const raw = sessionStorage.getItem(CONFIG_KEY);
      if (raw) setConfig(JSON.parse(raw));
    } catch {
      /* rien à reprendre */
    }
  }, []);
  const summary = config
    ? [config.paint !== "origine" && config.paintName, config.rims !== "origine" && "jantes changées", config.caliper !== "origine" && "étriers", config.roof && config.roof !== "origine" && "toit", config.stripes && config.stripes !== "origine" && "bandes"]
        .filter((x) => typeof x === "string" && x)
        .join(", ")
    : "";
  const cur = sizes.find((s) => s.id === size)!;
  const g = GALLERY[img];

  return (
    <>
      <section className="product">
        <div className="gallery">
          <figure className="gallery-main">
            <Image src={g.src} alt={g.alt} width={g.w} height={g.h} sizes="(max-width: 900px) 100vw, 640px" priority={img === 0} />
            <figcaption>{g.cap}</figcaption>
          </figure>
          <div className="gallery-thumbs" role="tablist" aria-label="Images du produit">
            {GALLERY.map((x, i) => (
              <button key={x.src} role="tab" aria-selected={i === img} className={i === img ? "on" : ""} onClick={() => setImg(i)} aria-label={x.cap}>
                <Image src={x.src} alt="" width={x.w} height={x.h} sizes="96px" />
              </button>
            ))}
          </div>
        </div>

        <div className="buy">
          <p className="buy-kicker">Pièce unique · fabriquée à la commande</p>
          <h1>Miniature personnalisée de ta voiture</h1>
          <p className="buy-price">
            {cur.price} € <span>socle blanc inclus</span>
          </p>
          <p className="buy-lead">
            On la recrée d'après tes photos, avec sa couleur, ses jantes et ses modifs. Tu reçois l'aperçu 3D gratuitement
            et tu ne paies que s'il te plaît.
          </p>

          <div className="buy-field">
            <span className="buy-label">
              Taille <b>{cur.label}</b> · {cur.length} de long
            </span>
            <div className="buy-sizes">
              {sizes.map((s) => (
                <button key={s.id} className={s.id === size ? "on" : ""} aria-pressed={s.id === size} onClick={() => setSize(s.id)}>
                  <b>{s.label}</b>
                  <span>{s.price} €</span>
                </button>
              ))}
            </div>
            <small>Tu pourras encore changer de taille après l'aperçu.</small>
          </div>

          <a href="#envoi" className="cta full buy-cta">
            Recevoir mon aperçu gratuit
          </a>

          <ul className="buy-ticks">
            <li>
              <Check /> Rien à payer avant d'avoir vu ton aperçu
            </li>
            <li>
              <Check /> Fabriquée en {lead} environ, livraison offerte en France
            </li>
            <li>
              <Check /> Abîmée ou différente de ta commande : refaite ou remboursée
            </li>
          </ul>

          <p className="buy-options">
            Options au moment de commander : {accessories.map((a) => `${a.label.toLowerCase()} (+${a.price} €)`).join(", ")}, toit
            contrasté, bandes.
          </p>
          {demo && (
            <p className="buy-demo">
              Envie de jouer avant ? <Link href={`/configurer/${demo}?taille=${size}`}>Essaie le configurateur 3D</Link>
            </p>
          )}
        </div>
      </section>

      <section className="send product-send" id="envoi">
        <header className="send-head">
          <h2>Envoie ta voiture</h2>
          <p className="lead">Gratuit et sans engagement. Ça prend deux minutes, et tu reçois ton aperçu 3D par e-mail.</p>
        </header>
        <div className="send-grid">
          <Uploader size={size} config={config} />
          <aside className="send-aside">
            <section>
              <h3>Ensuite</h3>
              <ol>
                <li>
                  <span>
                    <b>On recrée ta voiture en 3D</b> à partir de tes photos, avec ses jantes et ses modifs.
                  </span>
                </li>
                <li>
                  <span>
                    <b>Tu reçois ton aperçu</b> par e-mail, tu choisis la taille et les options.
                  </span>
                </li>
                <li>
                  <span>
                    <b>Tu commandes si ça te plaît.</b> Fabrication en {lead} environ.
                  </span>
                </li>
              </ol>
            </section>
            <section>
              <ul>
                <li>
                  <Check /> Taille souhaitée : {cur.label} ({cur.price} €)
                </li>
                {config && (
                  <li>
                    <Check /> Ta configuration 3D est jointe{summary ? ` : ${summary}` : ""}{" "}
                    <button
                      className="link"
                      onClick={() => {
                        setConfig(null);
                        try {
                          sessionStorage.removeItem(CONFIG_KEY);
                        } catch {}
                      }}
                    >
                      Retirer
                    </button>
                  </li>
                )}
                <li>
                  <Check /> Tes photos restent privées
                </li>
                <li>
                  <Check /> Livraison offerte en France
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </section>
    </>
  );
}
