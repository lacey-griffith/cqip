// JQL search helper for server routes (Batch 010).
//
// Deliberately separate from lib/jira/client.ts: that module throws at
// import time if the Jira env vars are missing. JIRA_API_TOKEN is a
// runtime-only Worker secret and is NOT present during `next build`, so a
// route that imported the throwing module would break the build at page-data
// collection. This module reads env lazily inside the function and only
// throws when actually invoked at request time.
//
// Uses the token-paginated /rest/api/3/search/jql endpoint (the legacy
// startAt/total search endpoint is deprecated): each page returns
// `nextPageToken` + `isLast`; we loop until `isLast` is true.

export interface JiraIssue {
  key: string;
  fields: Record<string, unknown>;
}

interface SearchJqlResponse {
  issues?: JiraIssue[];
  nextPageToken?: string;
  isLast?: boolean;
}

const PAGE_SIZE = 100;
// Backstop against an unterminated pagination loop (100 * 100 = 10k issues).
const MAX_PAGES = 100;

function jiraConfig() {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!baseUrl || !email || !token) {
    throw new Error('Missing Jira environment variables (JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN)');
  }
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  return { baseUrl, auth };
}

/**
 * Run a JQL query and return every matching issue, following pagination.
 *
 * @param jql    the JQL query string
 * @param fields the issue fields to return (e.g. ['key','summary','status'])
 */
export async function searchJql(jql: string, fields: string[]): Promise<JiraIssue[]> {
  const { baseUrl, auth } = jiraConfig();
  const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  let pages = 0;

  do {
    const body: Record<string, unknown> = { jql, fields, maxResults: PAGE_SIZE };
    if (nextPageToken) body.nextPageToken = nextPageToken;

    const res = await fetch(`${baseUrl}/rest/api/3/search/jql`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Jira JQL search failed: ${res.status} ${detail.slice(0, 300)}`);
    }

    const data = (await res.json()) as SearchJqlResponse;
    if (data.issues?.length) issues.push(...data.issues);
    nextPageToken = data.isLast ? undefined : data.nextPageToken;
    pages += 1;
  } while (nextPageToken && pages < MAX_PAGES);

  return issues;
}
