// SharePoint web URL → Graph site-id + drive-id resolver.
// Spec §6: GET /sites/{hostname}:/{server-relative-path} returns the
// site object; GET /sites/{site-id}/drive returns the default document
// library drive. Step 2 (folder route) layers folder-path parsing on
// top of this — Step 1 only needs the site/drive resolution scaffolding.

import { graphFetchJson } from './graph-client';

export interface ResolvedSite {
  siteId: string;
  driveId: string;
  hostname: string;
  serverRelativePath: string;
}

interface SiteResponse {
  id: string;
  webUrl: string;
}

interface DriveResponse {
  id: string;
}

export async function resolveSiteByHostAndPath(
  hostname: string,
  sitePath: string,
): Promise<ResolvedSite> {
  const cleanPath = sitePath.startsWith('/') ? sitePath : `/${sitePath}`;
  const siteSegment = `${encodeURIComponent(hostname)}:${cleanPath}`;
  const site = await graphFetchJson<SiteResponse>(`/sites/${siteSegment}`);
  const drive = await graphFetchJson<DriveResponse>(`/sites/${site.id}/drive`);
  return {
    siteId: site.id,
    driveId: drive.id,
    hostname,
    serverRelativePath: cleanPath,
  };
}

export async function resolveSiteFromConfig(): Promise<ResolvedSite> {
  const hostname = process.env.SHAREPOINT_SITE_HOSTNAME;
  const sitePath = process.env.SHAREPOINT_SITE_PATH;
  if (!hostname || !sitePath) {
    throw new Error('SHAREPOINT_SITE_HOSTNAME or SHAREPOINT_SITE_PATH not configured');
  }
  return resolveSiteByHostAndPath(hostname, sitePath);
}

// Q15-aligned URL normalization: lowercase host, strip trailing slash,
// decode percent-encoding once. The /folder route will use this for
// cache-key derivation; exposing it here keeps the SharePoint URL
// handling logic in one place.
export function normalizeFolderUrl(folderUrl: string): string {
  const url = new URL(folderUrl);
  url.hostname = url.hostname.toLowerCase();
  let pathname = url.pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // malformed percent-encoding — leave the raw pathname alone
  }
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  url.pathname = pathname;
  return `${url.protocol}//${url.hostname}${url.pathname}${url.search}`;
}

export function parseFolderUrl(folderUrl: string): {
  hostname: string;
  serverRelativePath: string;
} {
  const url = new URL(folderUrl);
  return {
    hostname: url.hostname.toLowerCase(),
    serverRelativePath: decodeURIComponent(url.pathname),
  };
}

// Share-link encoding per Graph docs: `u!` + base64url-without-padding.
// Used by /api/sharepoint/folder to translate the user-supplied
// SharePoint URL into a Graph driveItem without having to reverse-
// engineer the in-drive path. Spec §6 nominally lists the
// `/sites/{site-id}/drive/root:/{path}:/children` endpoint; share-link
// is a documented Graph alternative and is robust to URL form (UI
// browser URLs, share URLs, encoded paths, library-alias variants).
// Tracked as a Step 2 deviation in the batch report.
export function encodeShareId(folderUrl: string): string {
  const b64 = Buffer.from(folderUrl, 'utf-8').toString('base64');
  const stripped = b64.replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
  return `u!${stripped}`;
}
