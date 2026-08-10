import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getDashboardEnv } from "./lib/env";

const DASHBOARD_USERNAME = "admin";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: { password: { type: "password" } },
      authorize: async (credentials) => {
        const password = typeof credentials?.password === "string" ? credentials.password : undefined;
        if (!password) return null;
        const { DASHBOARD_PASSWORD_HASH } = getDashboardEnv();
        const valid = await bcrypt.compare(password, DASHBOARD_PASSWORD_HASH);
        return valid ? { id: DASHBOARD_USERNAME, name: DASHBOARD_USERNAME } : null;
      },
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
  // Vercel is an auto-trusted platform per Auth.js's own docs, but that
  // auto-detection didn't fire for a local `next start` (verified: without
  // this, every request 500s with "UntrustedHost" in production mode,
  // silently -- `next dev` doesn't enforce this check, so it went unnoticed
  // until this session's production-build verification). Explicit beats
  // relying on undocumented per-platform detection.
  trustHost: true,
  callbacks: {
    // Required for the bare `export { auth as middleware }` pattern in
    // middleware.ts to actually redirect unauthenticated requests, rather
    // than just making the session available -- verified against
    // authjs.dev/reference/nextjs.
    authorized: ({ auth: session, request }) => {
      if (request?.nextUrl?.pathname?.startsWith("/api/media")) return true;
      return !!session;
    },
  },
});
