import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

async function authenticate(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", { password: formData.get("password"), redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        action={authenticate}
        className="shadow-elevated w-full max-w-sm rounded-control border border-white/10 bg-surface p-8"
      >
        <h1 className="font-display mb-6 text-3xl font-light text-text-primary">Sign in</h1>
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-text-secondary">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          className="mb-4 w-full border border-white/10 bg-black/20 px-4 py-2 text-text-primary outline-none focus:border-primary"
        />
        {error && <p className="mb-4 text-sm text-red-400">Incorrect password.</p>}
        <button
          type="submit"
          className="w-full rounded-control bg-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 ease-brand hover:bg-primary/90"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
