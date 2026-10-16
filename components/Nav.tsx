import Link from "next/link";
import Logo from "./Logo";

export default function Nav({ link }: { link: { href: string; label: string } }) {
  return (
    <header className="nav">
      <Link href="/" className="logo" aria-label="JustMyRide, accueil">
        <Logo />
      </Link>
      <Link href={link.href} className="nav-cta">
        {link.label}
      </Link>
    </header>
  );
}
