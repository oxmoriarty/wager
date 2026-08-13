import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import {
  ALLOWED_AVATAR_TYPES,
  AVATAR_BUCKET,
  MAX_AVATAR_BYTES,
  getSupabaseAdmin,
} from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in.", 401, "UNAUTHENTICATED");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("Expected multipart/form-data with a `file` field.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return apiError("No file was uploaded.", 400, "MISSING_FILE");
  }

  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return apiError(
      "Avatars must be a JPEG, PNG, or WEBP image.",
      422,
      "UNSUPPORTED_TYPE",
    );
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return apiError("Avatars must be 5MB or smaller.", 422, "FILE_TOO_LARGE");
  }

  const extension = file.type.split("/")[1];
  const path = `avatars/${session.user.id}-${Date.now()}.${extension}`;

  try {
    const supabase = getSupabaseAdmin();
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error("Supabase avatar upload failed:", uploadError.message);
      return apiError(
        "Couldn't upload your avatar. Please try again.",
        502,
        "STORAGE_ERROR",
      );
    }

    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

    return apiSuccess({ avatarUrl: data.publicUrl }, "Avatar uploaded.");
  } catch (error) {
    console.error("Avatar upload failed:", error);
    return apiError(
      "Couldn't upload your avatar. Please try again.",
      500,
      "INTERNAL_ERROR",
    );
  }
}
