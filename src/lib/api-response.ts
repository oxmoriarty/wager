import { NextResponse } from "next/server";

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
}

export function apiSuccess<T>(
  data: T,
  message = "Success",
  status = 200,
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, message, data }, { status });
}

export function apiError(
  message: string,
  status = 400,
  code?: string,
): NextResponse<ApiError> {
  return NextResponse.json({ success: false, message, code }, { status });
}
