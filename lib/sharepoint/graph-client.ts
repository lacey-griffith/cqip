// Microsoft Graph client for the Batch 009 SharePoint proxy. Acquires
// a fresh Azure AD token per call (no caching per spec §6 — token
// caching adds expiry-tracking complexity for negligible latency gain
// on operator-driven single-ticket calls). Single 500ms-backoff retry
// on 5xx for BOTH the token exchange and the Graph request itself,
// per Q16 (resolved 2026-05-27).

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const TOKEN_SCOPE = 'https://graph.microsoft.com/.default';
const RETRY_BACKOFF_MS = 500;

export class GraphAuthError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'GraphAuthError';
    this.status = status;
  }
}

export class GraphRequestError extends Error {
  status: number;
  body?: string;
  constructor(message: string, status: number, body?: string) {
    super(message);
    this.name = 'GraphRequestError';
    this.status = status;
    this.body = body;
  }
}

function tokenEndpoint(tenantId: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
}

async function fetchWithSingleRetry5xx(input: string, init: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status >= 500 && res.status < 600) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
    return fetch(input, init);
  }
  return res;
}

export async function getGraphToken(): Promise<string> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    throw new GraphAuthError('Azure credentials not configured');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: TOKEN_SCOPE,
    grant_type: 'client_credentials',
  });

  const res = await fetchWithSingleRetry5xx(tokenEndpoint(tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new GraphAuthError(`Azure AD token exchange failed: ${res.status} ${text}`, res.status);
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new GraphAuthError('Azure AD response missing access_token');
  }
  return json.access_token;
}

// `token` is optional so a single route handler can `getGraphToken()` once
// and reuse the same access token across the 1-3 Graph calls that one
// logical request needs (folder enumeration → screenshots subfolder →
// metadata, etc.). Spec §6 says "fresh per call"; here "call" is the
// logical /folder|/xlsx|/image invocation, not each underlying fetch.
export async function graphFetch(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<Response> {
  const accessToken = token ?? (await getGraphToken());
  const url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  return fetchWithSingleRetry5xx(url, { ...init, headers });
}

export async function graphFetchJson<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const res = await graphFetch(path, init, token);
  if (res.status === 401 || res.status === 403) {
    throw new GraphAuthError(`Graph auth rejected: ${res.status}`, res.status);
  }
  if (res.status === 404) {
    throw new GraphRequestError('Graph 404', 404);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new GraphRequestError(`Graph request failed: ${res.status}`, res.status, body);
  }
  return (await res.json()) as T;
}
