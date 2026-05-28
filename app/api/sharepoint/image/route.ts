import { NextRequest, NextResponse } from 'next/server';
import { validateSharePointBearer, respondAuthFailure } from '@/lib/api/sharepoint-bearer-auth';
import {
  getGraphToken,
  graphFetch,
  graphFetchJson,
  GraphAuthError,
  GraphRequestError,
} from '@/lib/sharepoint/graph-client';
import { errorResponse, buildErrorEnvelope } from '@/lib/sharepoint/errors';

// GET /api/sharepoint/image?ref=<drive-id>:<item-id>
// Spec §3.3. Streams image bytes through Graph. 25 MB cap. NO cache
// (edge cache handles repeats; Worker doesn't store bytes).

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

interface FileMetadata {
  name: string;
  size?: number;
  file?: { mimeType?: string };
}

function parseRef(ref: string | null): { driveId: string; itemId: string } | null {
  if (!ref) return null;
  const colon = ref.indexOf(':');
  if (colon <= 0 || colon === ref.length - 1) return null;
  return { driveId: ref.slice(0, colon), itemId: ref.slice(colon + 1) };
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

  try {
    const token = await getGraphToken();
    const drivePath = `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`;

    const meta = await graphFetchJson<FileMetadata>(
      `${drivePath}?$select=name,size,file`,
      {},
      token,
    );

    if (typeof meta.size === 'number' && meta.size > MAX_IMAGE_BYTES) {
      return errorResponse('image_too_large', 'Image exceeds the 25 MB proxy cap', {
        max_bytes: MAX_IMAGE_BYTES,
        actual_bytes: meta.size,
      });
    }

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

    // F3 (Jenny C3 / Karen H2): Content-Length safety net. `meta.size`
    // is the first gate above; this catches the case where it was
    // missing/stale so we reject before buffering 25 MB+ into a
    // 128 MB Worker. Post-arrayBuffer length check stays as the
    // final backstop for when neither value is available.
    const contentLengthHeader = contentRes.headers.get('content-length');
    if (contentLengthHeader) {
      const advertised = parseInt(contentLengthHeader, 10);
      if (Number.isFinite(advertised) && advertised > MAX_IMAGE_BYTES) {
        return errorResponse('image_too_large', 'Image exceeds the 25 MB proxy cap', {
          max_bytes: MAX_IMAGE_BYTES,
          actual_bytes: advertised,
        });
      }
    }

    const bytes = await contentRes.arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return errorResponse('image_too_large', 'Image exceeds the 25 MB proxy cap', {
        max_bytes: MAX_IMAGE_BYTES,
        actual_bytes: bytes.byteLength,
      });
    }

    const contentType =
      contentRes.headers.get('content-type') ??
      meta.file?.mimeType ??
      'application/octet-stream';

    // F5 (Jenny #11): strip CR/LF/quote from the filename. A SharePoint
    // filename containing a newline would split the response header.
    const safeFilename = meta.name.replace(/[\r\n"]/g, '');
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    if (err instanceof GraphAuthError) {
      return NextResponse.json(
        buildErrorEnvelope('sharepoint_auth', 'Microsoft Graph rejected the proxy credentials'),
        { status: 502 },
      );
    }
    if (err instanceof GraphRequestError) {
      if (err.status === 404) {
        return NextResponse.json(
          buildErrorEnvelope('file_not_found', 'Not found in SharePoint', { ref: rawRef }),
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
    console.error('[sharepoint/image] unexpected', err);
    return NextResponse.json(buildErrorEnvelope('internal', 'Internal proxy error'), {
      status: 500,
    });
  }
}
