import { Nav } from "@/components/Nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-[1]">
      <Nav />
      <div className="p-6">{children}</div>
    </div>
  );
}
