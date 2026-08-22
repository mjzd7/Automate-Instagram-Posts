import { signOut } from "@/auth";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className="rounded-lg px-3 py-1.5 font-mono text-xs font-medium text-slate-muted transition-all duration-200 ease-brand outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
      >
        Sign out
      </button>
    </form>
  );
}
