import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import BeforeAfter from "@/components/BeforeAfter";
import { accessories, caliperColors, colors, exhausts, rimStyles, sizes, wheelColors } from "@/lib/options";
import { examples, hero, shots } from "@/lib/showcase";

const STEPS = [
  { img: shots.base, title: "Choisis ta voiture", text: "Dans le catalogue, ou envoie tes photos si elle n'y est pas encore." },
  { img: shots.detail, title: "Personnalise-la", text: "Jantes, échappement, couleur, étriers. Tout change en direct sur ta voiture en 3D." },
  { img: shots.done, title: "On la fabrique", text: "Tu valides l'aperçu, on la fabrique en pièce unique et on te l'envoie." },
];

const OPTIONS = [
  { title: "Jantes", text: `${rimStyles.length - 1} styles, ou les tiennes d'origine.`, dots: wheelColors.map((w) => w.hex) },
  { title: "Échappement", text: `${exhausts.length - 1} types de sorties, ou celui d'origine.`, dots: ["#2a2a2e", "#8f9095", "#c9ccd1"] },
  { title: "Couleur", text: `${colors.length} teintes, brillant, métal ou mat, ou ta couleur exacte.`, dots: colors.slice(0, 5).map((c) => c.hex) },
  { title: "Étriers", text: "La touche de couleur derrière les jantes.", dots: caliperColors.map((c) => c.hex) },
];

const FAQ = [
  [
    "Ma voiture n'est pas dans le catalogue, je fais comment ?",
    "Envoie-nous des photos en suivant le guide. On regarde si on peut la modéliser et on revient vers toi.",
  ],
  [
    "Les logos de la marque sont reproduits ?",
    "Non. Les miniatures sont livrées sans logo ni badge de constructeur. La forme, la couleur et les pièces sont celles de ta voiture.",
  ],
  [
    "Je vois le résultat avant de payer ?",
    "Oui. Le configurateur te montre ta voiture en 3D avec tes choix, et c'est cette version qui part en fabrication.",
  ],
  [
    "Quelle taille choisir ?",
    `Le 1:43 (${sizes[0].length}) tient sur un bureau, le 1:24 (${sizes[1].length}) est le bon compromis, le 1:18 (${sizes[2].length}) montre le plus de détails.`,
  ],
];

export default function Home() {
  const from = Math.min(...sizes.map((s) => s.price));
  return (
    <main>
      <Nav />

      <header className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div>
              <p className="eyebrow">Miniatures sur mesure</p>
              <h1>
                Ta voiture.
                <br />
                <span>En miniature.</span>
              </h1>
              <p className="lead">
                Tu choisis ta voiture, tes jantes, ton échappement et ta couleur. On fabrique la réplique, en pièce
                unique.
              </p>
              <div className="ctas">
                <Link href="/configurer" className="cta">
                  Personnaliser ma voiture <b>→</b>
                </Link>
                <Link href="/envoyer" className="cta ghost">
                  Envoyer mes photos
                </Link>
              </div>
            </div>
            <div>
              <BeforeAfter
                before={hero.before.src}
                beforeLabel={hero.before.label}
                after={hero.after.src}
                afterLabel={hero.after.label}
              />
              <p className="note">
                Rendus 3D du modèle avant fabrication. Les photos des premières miniatures imprimées arrivent bientôt.
              </p>
            </div>
          </div>
          <div className="trust">
            <div>
              <b>Pièce unique</b>Faite pour ta voiture
            </div>
            <div>
              <b>{sizes.length} tailles</b>
              {sizes.map((s) => s.label).join(", ")}
            </div>
            <div>
              <b>Aperçu 3D</b>Tu vois le résultat avant
            </div>
            <div>
              <b>Sans logo</b>Ni badge de marque
            </div>
          </div>
        </div>
      </header>

      <section className="sec" id="comment">
        <div className="wrap">
          <div className="sec-head">
            <h2>
              Comment
              <br />
              ça marche
            </h2>
            <p>Trois étapes, et tu vois ta miniature en 3D avant qu'on la fabrique.</p>
          </div>
          <div className="steps">
            {STEPS.map((s, i) => (
              <div className="howto" key={s.title}>
                <div className="howto-img">
                  <img src={s.img} alt="" loading="lazy" />
                  <span className="howto-n">0{i + 1}</span>
                </div>
                <div className="howto-t">
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec" id="exemples">
        <div className="wrap">
          <div className="sec-head">
            <h2>Exemples</h2>
            <p>
              Une même base, des milliers de combinaisons. <span className="pill">Rendus 3D</span>
            </p>
          </div>
          <div className="examples">
            {examples.map((e) => (
              <Link href="/configurer/bmw-m140i" className="ex-card" key={e.name}>
                <img src={e.img} alt={e.name} loading="lazy" />
                <div className="ex-meta">
                  <div>
                    <h4>{e.name}</h4>
                    <small>{e.detail}</small>
                  </div>
                  <strong>dès {from} €</strong>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <div className="sec-head">
            <h2>
              Ce que
              <br />
              tu changes
            </h2>
            <p>Chaque option peut rester d'origine. Tu ne touches qu'à ce que tu veux.</p>
          </div>
          <div className="options-band">
            {OPTIONS.map((o) => (
              <div className="opt" key={o.title}>
                <div className="opt-dots">
                  {o.dots.map((d) => (
                    <i key={d} style={{ background: d }} />
                  ))}
                </div>
                <h3>{o.title}</h3>
                <p>{o.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec" id="prix">
        <div className="wrap">
          <div className="sec-head">
            <h2>
              Tailles
              <br />
              et prix
            </h2>
            <p>Toutes les options de personnalisation sont comprises dans le prix.</p>
          </div>
          <div className="price-grid">
            {sizes.map((s, i) => (
              <div className={`price-card ${i === 1 ? "pop" : ""}`} key={s.id}>
                {i === 1 && <span className="badge">NOTRE CONSEIL</span>}
                <div className="display scale">{s.label}</div>
                <div className="len">{s.length} de long</div>
                <div className="amount">
                  {s.price} € <small>TTC</small>
                </div>
                <ul>
                  <li>Couleur, jantes, échappement, étriers</li>
                  <li>Aperçu 3D avant fabrication</li>
                  <li>Pièce unique, sans logo</li>
                </ul>
                <Link href="/configurer" className={`cta ${i === 1 ? "accent" : ""}`}>
                  Choisir le {s.label}
                </Link>
              </div>
            ))}
          </div>
          <p className="price-note">
            En option : {accessories.map((a) => `${a.label.toLowerCase()} (+${a.price} €)`).join(", ")}.
          </p>
        </div>
      </section>

      <section className="sec" id="faq">
        <div className="wrap">
          <div className="sec-head">
            <h2>Questions</h2>
          </div>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <div className="wrap">
        <div className="big-cta">
          <div>
            <h2>
              Prête à
              <br />
              <span>rouler ?</span>
            </h2>
            <p>Monte ta config en quelques minutes. Tu vois le résultat avant de commander.</p>
            <Link href="/configurer" className="cta">
              Commencer <b>→</b>
            </Link>
          </div>
          <img src={shots.wide} alt="" loading="lazy" />
        </div>
      </div>

      <Footer />
    </main>
  );
}
