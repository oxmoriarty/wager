import type { NextAuthConfig } from "next-auth";

/**
 * Split from `src/auth.ts` on purpose. Next.js Proxy (formerly Middleware)
 * runs on every matched request, including prefetches, and Next's own docs
 * say to keep it to cookie/JWT checks only — never database calls. Since
 * this config has no Prisma adapter and no Credentials `authorize` (which
 * would pull in bcrypt + Prisma), it's safe to import from `proxy.ts`.
 *
 * The full config with the Prisma adapter and Credentials provider lives in
 * `src/auth.ts` and is only ever imported from Node-runtime code (API route
 * handlers, Server Components).
 */
export const authConfig = {
  pages: { signIn: "/sign-in" },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token.userId && typeof token.userId === "string") {
        session.user.id = token.userId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
