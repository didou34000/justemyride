import Link from "next/link";

export default function Nav({ link }: { link: { href: string; label: string } }) {
  return (
    <header className="nav">
      <Link href="/" className="logo">
        JUST<b>MY</b>RIDE
      </Link>
      <Link href={link.href} className="nav-cta">
        {link.label}
      </Link>
    </header>
  );
}
