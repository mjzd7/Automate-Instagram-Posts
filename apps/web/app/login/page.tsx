import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { TriNodeMark } from "@/components/TriNodeMark";

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
        data-testid="login-form"
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[rgba(18,18,22,0.85)] p-8 shadow-titanium backdrop-blur-[20px]"
      >
        <div className="mb-6 flex items-center gap-3">
          <TriNodeMark size={28} />
          <h1 className="font-display text-xl font-bold tracking-[-0.03em] lowercase text-white">poster</h1>
        </div>
        <label htmlFor="password" className="mb-2 block font-mono text-xs uppercase tracking-wider text-slate-muted">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          className="mb-4 w-full rounded-lg border border-white/15 bg-black px-3.5 py-2.5 font-mono text-white outline-none transition-colors duration-200 ease-brand focus:border-white focus-visible:ring-2 focus-visible:ring-white/60"
        />
        {error && (
          <p role="alert" className="mb-4 font-mono text-sm text-red-400">
            Incorrect password.
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors duration-200 ease-brand outline-none hover:bg-platinum focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
