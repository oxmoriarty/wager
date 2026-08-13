import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { signInSchema } from "@/lib/validation/auth";
import { authConfig } from "@/auth.config";

// Full, Node-only config: Prisma adapter + Credentials provider (bcrypt +
// database lookups). Only import this from API routes / Server Components
// — never from proxy.ts. See src/auth.config.ts for why.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = signInSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { profile: true },
        });
        if (!user) return null;

        const isValidPassword = await bcrypt.compare(
          password,
          user.passwordHash,
        );
        if (!isValidPassword) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.profile?.displayName ?? null,
          image: user.profile?.avatarUrl ?? null,
        };
      },
    }),
  ],
});
