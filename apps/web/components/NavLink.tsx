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
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition-all duration-200 ease-brand outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
        active ? "bg-white/5 text-white" : "text-slate-muted hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
