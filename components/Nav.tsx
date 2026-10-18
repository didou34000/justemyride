import Link from "next/link";
import Logo from "./Logo";

export default function Nav({ link }: { link: { href: string; label: string } }) {
  return (
    <header className="nav">
      <div className="nav-stripes" aria-hidden />
      <Link href="/" className="logo" aria-label="JustMyRide, accueil">
        <Logo />
      </Link>
      <nav className="nav-links">
        <Link href="/configurer">Le garage</Link>
        <Link href="/#tailles">Tailles</Link>
        <Link href="/#faq">FAQ</Link>
      </nav>
      <Link href={link.href} className="nav-cta">
        {link.label}
      </Link>
    </header>
  );
}
