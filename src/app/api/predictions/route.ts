import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createPredictionSchema } from "@/lib/validation/prediction";
import { emitFeedUpdate } from "@/lib/socket/emit";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in.", 401, "UNAUTHENTICATED");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON.", 400);
  }

  const parsed = createPredictionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Invalid prediction.",
      422,
      "VALIDATION_ERROR",
    );
  }

  const { marketId, side, content } = parsed.data;

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { id: true, status: true },
  });

  if (!market) {
    return apiError("That market no longer exists.", 404, "MARKET_NOT_FOUND");
  }
  if (market.status !== "OPEN") {
    return apiError(
      "This market is no longer open for predictions.",
      422,
      "MARKET_CLOSED",
    );
  }

  try {
    const prediction = await prisma.prediction.create({
      data: {
        authorId: session.user.id,
        marketId,
        side,
        content,
      },
      select: { id: true },
    });

    emitFeedUpdate({ predictionId: prediction.id });

    return apiSuccess(prediction, "Prediction posted.", 201);
  } catch (error) {
    console.error("Failed to create prediction:", error);
    return apiError(
      "Something went wrong posting your prediction. Please try again.",
      500,
      "INTERNAL_ERROR",
    );
  }
}
