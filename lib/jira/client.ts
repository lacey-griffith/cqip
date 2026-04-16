const baseUrl = process.env.JIRA_BASE_URL;
const jiraEmail = process.env.JIRA_EMAIL;
const jiraApiToken = process.env.JIRA_API_TOKEN;

if (!baseUrl || !jiraEmail || !jiraApiToken) {
  throw new Error('Missing Jira environment variables');
}

const jiraAuth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64');

export const jiraHeaders = {
  Authorization: `Basic ${jiraAuth}`,
  'Content-Type': 'application/json',
};

export async function getIssue(issueKey: string) {
  const response = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}`, {
    headers: jiraHeaders,
  });

  if (!response.ok) {
    throw new Error(`Jira API request failed: ${response.status}`);
  }

  return response.json();
}

export async function getIssueChangelog(issueKey: string) {
  const response = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/changelog`, {
    headers: jiraHeaders,
  });

  if (!response.ok) {
    throw new Error(`Jira changelog API request failed: ${response.status}`);
  }

  return response.json();
}