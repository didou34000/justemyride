import Configurator from "@/components/Configurator";

export default function Home() {
  return (
    <main>
      <header className="nav">
        <span className="logo">
          JUST<b>MY</b>RIDE
        </span>
        <a href="#configurer" className="nav-cta">
          Configurer
        </a>
      </header>

      <section className="hero">
        <p className="eyebrow">Miniatures sur mesure</p>
        <h1>
          Ta voiture.
          <br />
          <span>En miniature.</span>
        </h1>
        <p className="lead">
          Envoie quelques photos, choisis ta teinte, tes jantes et ta plaque. On modélise ta voiture et on la
          fabrique, pièce unique.
        </p>
        <a href="#configurer" className="cta">
          Commencer
        </a>
        <ol className="how">
          <li>
            <b>01</b>Photos ou vidéo
          </li>
          <li>
            <b>02</b>Personnalisation
          </li>
          <li>
            <b>03</b>Fabrication et livraison
          </li>
        </ol>
      </section>

      <Configurator />

      <footer className="foot">© {new Date().getFullYear()} JustMyRide</footer>
    </main>
  );
}
