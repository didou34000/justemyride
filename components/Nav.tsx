import Link from "next/link";

const LINKS = [
  { href: "/configurer", label: "Configurer" },
  { href: "/#exemples", label: "Exemples" },
  { href: "/#comment", label: "Comment ça marche" },
  { href: "/#prix", label: "Tailles et prix" },
  { href: "/#faq", label: "FAQ" },
];

export default function Nav({ cta = { href: "/configurer", label: "Personnaliser" } }: { cta?: { href: string; label: string } }) {
  return (
    <>
      <div className="ann">
        Miniatures fabriquées à la commande · <b>Pièce unique</b> · Livrées sans logo de marque
      </div>
      <header className="nav">
        <div className="wrap nav-in">
          <Link href="/" className="logo">
            JUST<b>MY</b>RIDE
          </Link>
          <ul className="nav-links">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
          <Link href={cta.href} className="cta nav-cta">
            {cta.label} <b>→</b>
          </Link>
        </div>
      </header>
    </>
  );
}
