import { prisma } from "@/lib/prisma";
import { apiSuccess } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return apiSuccess({ unverified: false });
    }
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { emailVerified: true },
    });
    return apiSuccess({ unverified: Boolean(user && !user.emailVerified) });
  } catch {
    return apiSuccess({ unverified: false });
  }
}
