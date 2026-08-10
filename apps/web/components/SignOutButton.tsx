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
        className="rounded-control px-4 py-2 text-sm font-medium text-text-secondary transition-colors duration-150 ease-brand hover:text-text-primary"
      >
        Sign out
      </button>
    </form>
  );
}
