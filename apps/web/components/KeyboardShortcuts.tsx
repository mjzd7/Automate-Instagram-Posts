"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NAV_LINKS } from "@/lib/nav-links";

const PREFIX_WINDOW_MS = 1200;

/**
 * g-palette: press "g", then a destination initial within the window.
 * Initials are unique across NAV_LINKS by construction (asserted in tests).
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let armed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (!armed && event.key.toLowerCase() === "g") {
        armed = true;
        setPending(true);
        timer = setTimeout(() => {
          armed = false;
          setPending(false);
        }, PREFIX_WINDOW_MS);
        return;
      }
      if (armed) {
        const match = NAV_LINKS.find((link) => link.label.toLowerCase()[0] === event.key.toLowerCase());
        clearTimeout(timer);
        armed = false;
        setPending(false);
        if (match) {
          event.preventDefault();
          router.push(match.href);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(timer);
    };
  }, [router]);

  if (!pending) return null;
  return (
    <div
      data-testid="kbd-pending"
      className="fixed bottom-4 right-4 z-50 rounded-lg border border-white/10 bg-surface px-3 py-2 font-mono text-xs text-platinum shadow-titanium"
    >
      g· … press a destination initial
    </div>
  );
}
