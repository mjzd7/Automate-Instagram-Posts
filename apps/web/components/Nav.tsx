import { NavLink } from "./NavLink";
import { SignOutButton } from "./SignOutButton";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/accounts", label: "Accounts" },
  { href: "/categories", label: "Categories" },
  { href: "/templates", label: "Templates" },
  { href: "/history", label: "History" },
  { href: "/preview", label: "Preview" },
];

export function Nav() {
  return (
    <nav className="shadow-elevated sticky top-6 z-10 mx-6 mt-6 flex items-center justify-between gap-2 rounded-control border border-white/10 bg-surface px-4 py-2">
      <div className="flex items-center gap-1">
        {LINKS.map((link) => (
          <NavLink key={link.href} href={link.href}>
            {link.label}
          </NavLink>
        ))}
      </div>
      <SignOutButton />
    </nav>
  );
}
