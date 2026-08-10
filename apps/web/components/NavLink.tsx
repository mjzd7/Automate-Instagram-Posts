"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`rounded-control px-4 py-2 text-sm font-medium transition-colors duration-150 ease-brand ${
        active ? "bg-primary text-white" : "text-text-secondary hover:text-text-primary"
      }`}
    >
      {children}
    </Link>
  );
}
