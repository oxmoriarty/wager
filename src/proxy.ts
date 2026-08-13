import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";

// Deliberately built from the edge-safe `authConfig` (no Prisma, no
// bcrypt) rather than the full config in `src/auth.ts` — see that file's
// comment. This only ever reads the session JWT from the request cookie.
const { auth } = NextAuth(authConfig);

const AUTH_PAGES = ["/sign-in", "/sign-up"];

export default auth((request) => {
  const isAuthPage = AUTH_PAGES.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (isAuthPage && request.auth) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/sign-in", "/sign-up"],
};
