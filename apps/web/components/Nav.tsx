import Link from "next/link";
import { NavLink } from "./NavLink";
import { SignOutButton } from "./SignOutButton";
import { TriNodeMark } from "./TriNodeMark";
import { NAV_LINKS as LINKS } from "@/lib/nav-links";

export function Nav() {
  return (
    <header className="sticky top-0 z-10 mx-auto mt-6 flex w-full max-w-7xl items-center justify-between gap-4 px-6">
      <Link
        href="/"
        data-testid="brand-mark"
        className="flex items-center gap-2 text-white outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        aria-label="poster home"
      >
        <TriNodeMark size={22} />
        <span className="font-display text-lg font-bold tracking-[-0.03em] lowercase">poster</span>
      </Link>
      <div className="flex items-center gap-3">
        <nav className="flex items-center space-x-1 overflow-x-auto rounded-xl border border-white/10 bg-surface p-1">
          {LINKS.map((link) => (
            <NavLink key={link.href} href={link.href}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <SignOutButton />
      </div>
    </header>
  );
}

