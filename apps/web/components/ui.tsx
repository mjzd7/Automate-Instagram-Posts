import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Monochrome Titanium primitive kit (DAGR-derived). Geometry stays literal
 * in markup; only color/font/easing flow through @theme tokens.
 */

export function TitaniumCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[rgba(18,18,22,0.85)] shadow-titanium backdrop-blur-[20px] ${className}`}
    >
      {children}
    </div>
  );
}

export function StatBlock({
  label,
  value,
  detail,
  barPercent,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  barPercent?: number;
}) {
  return (
    <TitaniumCard className="p-5">
      <div className="mb-2 flex items-center justify-between font-mono text-xs uppercase tracking-wider text-slate-muted">
        <span>{label}</span>
        {detail && <span className="font-mono text-white">{detail}</span>}
      </div>
      <div className="font-mono text-3xl font-extrabold tracking-tight text-white">{value}</div>
      {typeof barPercent === "number" && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full border border-white/5 bg-zinc-900">
          <div
            className="h-full rounded-full bg-white transition-all duration-500"
            style={{ width: `${Math.min(Math.max(barPercent, 0), 100)}%` }}
          />
        </div>
      )}
    </TitaniumCard>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-white">{title}</h1>
      {subtitle && <p className="mt-1 font-mono text-xs text-slate-muted">{subtitle}</p>}
    </div>
  );
}

const BUTTON_BASE =
  "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 ease-brand outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANTS = {
  primary: "bg-white text-black hover:bg-platinum",
  ghost: "border border-white/10 text-slate-muted hover:border-white/20 hover:text-white",
  danger: "border border-red-500/30 text-red-400 hover:border-red-500/50 hover:text-red-300",
} as const;

type ButtonVariant = keyof typeof BUTTON_VARIANTS;

function buttonClass(variant: ButtonVariant): string {
  return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={`${buttonClass(variant)} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={`${buttonClass(variant)} ${className}`} {...props} />;
}

export function Th({
  children,
  right = false,
}: {
  children: ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`border-b border-white/10 bg-black px-4 py-3 font-mono text-xs uppercase tracking-wider text-slate-muted ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  right = false,
  mono = true,
}: {
  children: ReactNode;
  right?: boolean;
  mono?: boolean;
}) {
  return (
    <td
      className={`px-4 py-3 text-platinum ${mono ? "font-mono" : ""} ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </td>
  );
}

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <TitaniumCard className="overflow-x-auto">
      <table className="w-full text-left font-mono text-xs">{children}</table>
    </TitaniumCard>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-white/5 text-platinum">{children}</tbody>;
}

export function EmptyState({ message }: { message: ReactNode }) {
  return <p className="py-8 text-center font-mono text-sm text-slate-muted">{message}</p>;
}

export function Banner({
  variant = "error",
  children,
}: {
  variant?: "error" | "info";
  children: ReactNode;
}) {
  const style =
    variant === "error"
      ? "border-red-500/30 bg-red-500/5 text-red-400"
      : "border-white/10 bg-white/[0.03] text-slate-muted";
  return (
    <div role={variant === "error" ? "alert" : undefined} className={`rounded-xl border p-4 font-mono text-sm ${style}`}>
      {children}
    </div>
  );
}
