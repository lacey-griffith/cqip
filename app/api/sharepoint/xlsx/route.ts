import { NextRequest, NextResponse } from 'next/server';
import { validateSharePointBearer, respondAuthFailure } from '@/lib/api/sharepoint-bearer-auth';
import {
  getGraphToken,
  graphFetch,
  graphFetchJson,
  GraphAuthError,
  GraphRequestError,
} from '@/lib/sharepoint/graph-client';
import {
  parsePreviewLinks,
  PreviewSheetNotFoundError,
  PREVIEW_SHEET_NAME,
  type PreviewRow,
} from '@/lib/sharepoint/xlsx-parser';
import { cacheGet, cacheSet } from '@/lib/sharepoint/cache';
import { errorResponse, buildErrorEnvelope } from '@/lib/sharepoint/errors';

// GET /api/sharepoint/xlsx?ref=<drive-id>:<item-id>
// Spec §3.2. Parses the `Preview Links` sheet and returns rows.
// 60s in-memory cache keyed on the opaque ref.

interface XlsxResponse {
  filename: string;
  rows: PreviewRow[];
}

interface FileMetadata {
  name: string;
  size?: number;
}

function parseRef(ref: string | null): { driveId: string; itemId: string } | null {
  if (!ref) return null;
  const colon = ref.indexOf(':');
  if (colon <= 0 || colon === ref.length - 1) return null;
  const driveId = ref.slice(0, colon);
  const itemId = ref.slice(colon + 1);
  if (!driveId || !itemId) return null;
  return { driveId, itemId };
}

export async function GET(req: NextRequest) {
  const auth = validateSharePointBearer(req);
  if (!auth.ok) return respondAuthFailure(auth);

  const rawRef = req.nextUrl.searchParams.get('ref');
  const parsed = parseRef(rawRef);
  if (!parsed) {
    return errorResponse('file_not_found', 'Missing or malformed ref query parameter', {
      ref: rawRef,
    });
  }
  const { driveId, itemId } = parsed;
  const noCache = req.nextUrl.searchParams.get('nocache') === '1';
  const cacheKey = `xlsx:${driveId}:${itemId}`;

  if (!noCache) {
    const hit = cacheGet<XlsxResponse>(cacheKey);
    if (hit) return NextResponse.json(hit);
  }

  try {
    const token = await getGraphToken();
    const drivePath = `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`;

    const meta = await graphFetchJson<FileMetadata>(`${drivePath}?$select=name,size`, {}, token);

    const contentRes = await graphFetch(`${drivePath}/content`, {}, token);
    if (contentRes.status === 401 || contentRes.status === 403) {
      throw new GraphAuthError(`Graph auth rejected: ${contentRes.status}`, contentRes.status);
    }
    if (contentRes.status === 404) {
      throw new GraphRequestError('Graph 404', 404);
    }
    if (!contentRes.ok) {
      throw new GraphRequestError(`Graph request failed: ${contentRes.status}`, contentRes.status);
    }
    const bytes = await contentRes.arrayBuffer();

    const rows = parsePreviewLinks(bytes);

    const body: XlsxResponse = { filename: meta.name, rows };
    if (!noCache) cacheSet(cacheKey, body);
    return NextResponse.json(body);
  } catch (err) {
    if (err instanceof PreviewSheetNotFoundError) {
      return errorResponse('sheet_not_found', err.message, { expected: PREVIEW_SHEET_NAME });
    }
    return handleGraphError(err, { ref: rawRef });
  }
}

function handleGraphError(err: unknown, context: Record<string, unknown>): NextResponse {
  if (err instanceof GraphAuthError) {
    return NextResponse.json(
      buildErrorEnvelope('sharepoint_auth', 'Microsoft Graph rejected the proxy credentials'),
      { status: 502 },
    );
  }
  if (err instanceof GraphRequestError) {
    if (err.status === 404) {
      return NextResponse.json(
        buildErrorEnvelope('file_not_found', 'Not found in SharePoint', context),
        { status: 404 },
      );
    }
    if (err.status >= 500) {
      return NextResponse.json(
        buildErrorEnvelope('sharepoint_upstream', 'Microsoft Graph error', {
          graph_status: err.status,
        }),
        { status: 502 },
      );
    }
  }
  console.error('[sharepoint/xlsx] unexpected', err);
  return NextResponse.json(buildErrorEnvelope('internal', 'Internal proxy error'), {
    status: 500,
  });
}
