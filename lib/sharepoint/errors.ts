// Error envelope per spec §4. Codes are locked; HTTP statuses derive
// from the matrix. Context fields vary per code.

import { NextResponse } from 'next/server';

export type ErrorCode =
  | 'unauthorized'
  | 'folder_not_found'
  | 'file_not_found'
  | 'multiple_xlsx_at_root'
  | 'xlsx_not_found'
  | 'sheet_not_found'
  | 'image_too_large'
  | 'sharepoint_auth'
  | 'sharepoint_upstream'
  | 'internal';

// xlsx_not_found added 2026-05-28: D2 flipped from soft-fail (warning,
// 200) to hard-fail (422). 0 xlsx at folder root means the ticket
// structure isn't set up for QA yet; AC needs the hard signal to gate
// Phase 2 work. Missing/empty Shareable Screenshots/ stays soft-fail.
export const ERROR_STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  folder_not_found: 404,
  file_not_found: 404,
  multiple_xlsx_at_root: 422,
  xlsx_not_found: 422,
  sheet_not_found: 422,
  image_too_large: 413,
  sharepoint_auth: 502,
  sharepoint_upstream: 502,
  internal: 500,
};

export interface ErrorEnvelope {
  error: ErrorCode;
  message: string;
  [key: string]: unknown;
}

export function buildErrorEnvelope(
  code: ErrorCode,
  message: string,
  context: Record<string, unknown> = {},
): ErrorEnvelope {
  return { error: code, message, ...context };
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  context: Record<string, unknown> = {},
): NextResponse {
  return NextResponse.json(buildErrorEnvelope(code, message, context), {
    status: ERROR_STATUS[code],
  });
}
