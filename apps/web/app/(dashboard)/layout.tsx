import { Nav } from "@/components/Nav";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-[1]">
      <Nav />
      <main className="mx-auto w-full max-w-7xl space-y-6 p-6">{children}</main>
      <KeyboardShortcuts />
    </div>
  );
}
