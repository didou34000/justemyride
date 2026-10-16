import Link from "next/link";

export default function Nav({ link }: { link: { href: string; label: string } }) {
  return (
    <header className="nav">
      <Link href="/" className="logo">
        just<b>my</b>ride
      </Link>
      <Link href={link.href} className="nav-cta">
        {link.label}
      </Link>
    </header>
  );
}
