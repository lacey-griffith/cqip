import { NextRequest, NextResponse } from 'next/server';
import { validateSharePointBearer, respondAuthFailure } from '@/lib/api/sharepoint-bearer-auth';
import {
  getGraphToken,
  graphFetchJson,
  GraphAuthError,
  GraphRequestError,
} from '@/lib/sharepoint/graph-client';
import { encodeShareId, normalizeFolderUrl } from '@/lib/sharepoint/site-resolver';
import {
  filterRoot,
  filterScreenshots,
  type DriveItem,
} from '@/lib/sharepoint/folder-filter';
import { cacheGet, cacheSet } from '@/lib/sharepoint/cache';
import { errorResponse, buildErrorEnvelope } from '@/lib/sharepoint/errors';

// GET /api/sharepoint/folder?url=<folder-url>
// Spec §3.1. Returns structured folder enumeration: folder metadata +
// the single xlsx at root + sorted screenshots from
// `Shareable Screenshots/` (when present). `assets/` and `bugs/` are
// ignored. 60s in-memory cache keyed on Q15-normalized URL.

interface FolderResponse {
  folder: { url: string; name: string };
  xlsx: { ref: string; name: string } | null;
  screenshots: { ref: string; name: string; size: number }[];
  warnings: { code: string; message: string }[];
}

interface ChildrenResponse {
  value: DriveItem[];
  '@odata.nextLink'?: string;
}

interface ShareDriveItem {
  id: string;
  name: string;
  parentReference?: { driveId?: string };
  folder?: { childCount?: number } | null;
}

async function enumerateAllChildren(
  driveId: string,
  itemId: string,
  token: string,
): Promise<DriveItem[]> {
  const items: DriveItem[] = [];
  let next: string | undefined =
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/children?$top=200`;
  while (next) {
    const page: ChildrenResponse = await graphFetchJson<ChildrenResponse>(next, {}, token);
    items.push(...page.value);
    next = page['@odata.nextLink'];
  }
  return items;
}

function hostnameAllowed(folderUrl: string): boolean {
  const allowed = process.env.SHAREPOINT_SITE_HOSTNAME;
  if (!allowed) return true;
  try {
    const u = new URL(folderUrl);
    return u.hostname.toLowerCase() === allowed.toLowerCase();
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const auth = validateSharePointBearer(req);
  if (!auth.ok) return respondAuthFailure(auth);

  const rawUrl = req.nextUrl.searchParams.get('url');
  if (!rawUrl) {
    return errorResponse('folder_not_found', 'Missing url query parameter', { url: null });
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeFolderUrl(rawUrl);
  } catch {
    return errorResponse('folder_not_found', 'Malformed url query parameter', { url: rawUrl });
  }

  if (!hostnameAllowed(normalizedUrl)) {
    return errorResponse('folder_not_found', 'URL is outside the configured SharePoint tenant', {
      url: rawUrl,
    });
  }

  const noCache = req.nextUrl.searchParams.get('nocache') === '1';
  const cacheKey = `folder:${normalizedUrl}`;

  if (!noCache) {
    const hit = cacheGet<FolderResponse>(cacheKey);
    if (hit) return NextResponse.json(hit);
  }

  try {
    const token = await getGraphToken();

    const folderItem = await graphFetchJson<ShareDriveItem>(
      `/shares/${encodeShareId(normalizedUrl)}/driveItem`,
      {},
      token,
    );
    const driveId = folderItem.parentReference?.driveId;
    if (!driveId) {
      return errorResponse('folder_not_found', 'Folder has no parent drive reference', {
        url: rawUrl,
      });
    }
    if (!folderItem.folder) {
      return errorResponse('folder_not_found', 'URL does not resolve to a folder', {
        url: rawUrl,
      });
    }

    const children = await enumerateAllChildren(driveId, folderItem.id, token);
    const root = filterRoot(children, driveId);

    const warnings: { code: string; message: string }[] = [];

    if (root.xlsxCandidateNames.length > 1) {
      return errorResponse(
        'multiple_xlsx_at_root',
        'Folder root contains more than one xlsx file',
        { filenames: root.xlsxCandidateNames },
      );
    }
    if (root.xlsx === null) {
      // Hard-fail per D2 decision (2026-05-28). 0 xlsx means the ticket
      // structure isn't set up for QA yet; AC needs the 422 to gate
      // Phase 2 work rather than inspecting a soft warning.
      return errorResponse(
        'xlsx_not_found',
        'No xlsx file found at folder root',
        { url: rawUrl },
      );
    }

    let screenshots: FolderResponse['screenshots'] = [];
    if (root.screenshotsFolder) {
      // F2 (Jenny #7): isolate the subfolder enumeration so a 404 here
      // — possible if the folder was deleted between root-listing and
      // child-listing — degrades to the soft-fail warning instead of
      // misclassifying as `folder_not_found`. Non-404 errors propagate
      // to the outer handler.
      try {
        const screenshotItems = await enumerateAllChildren(
          root.screenshotsFolder.driveId,
          root.screenshotsFolder.itemId,
          token,
        );
        screenshots = filterScreenshots(screenshotItems, root.screenshotsFolder.driveId);
        if (screenshots.length === 0) {
          warnings.push({
            code: 'empty_screenshots_folder',
            message: 'Shareable Screenshots/ exists but is empty',
          });
        }
      } catch (subErr) {
        if (subErr instanceof GraphRequestError && subErr.status === 404) {
          warnings.push({
            code: 'screenshots_folder_missing',
            message: 'Shareable Screenshots/ disappeared between root and child listing',
          });
          screenshots = [];
        } else {
          throw subErr;
        }
      }
    } else {
      warnings.push({
        code: 'screenshots_folder_missing',
        message: 'Shareable Screenshots/ subfolder not found',
      });
    }

    const body: FolderResponse = {
      folder: { url: normalizedUrl, name: folderItem.name },
      xlsx: root.xlsx,
      screenshots,
      warnings,
    };

    if (!noCache) cacheSet(cacheKey, body);
    return NextResponse.json(body);
  } catch (err) {
    return handleGraphError(err, { url: rawUrl }, 'folder_not_found');
  }
}

function handleGraphError(
  err: unknown,
  context: Record<string, unknown>,
  notFoundCode: 'folder_not_found' | 'file_not_found',
): NextResponse {
  if (err instanceof GraphAuthError) {
    return NextResponse.json(
      buildErrorEnvelope('sharepoint_auth', 'Microsoft Graph rejected the proxy credentials'),
      { status: 502 },
    );
  }
  if (err instanceof GraphRequestError) {
    if (err.status === 404) {
      return NextResponse.json(buildErrorEnvelope(notFoundCode, 'Not found in SharePoint', context), {
        status: 404,
      });
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
  console.error('[sharepoint/folder] unexpected', err);
  return NextResponse.json(buildErrorEnvelope('internal', 'Internal proxy error'), {
    status: 500,
  });
}
