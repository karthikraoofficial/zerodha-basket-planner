// Commit one file to the repo via the GitHub contents API. Used to publish the daily ranked list;
// the push then triggers the price job and a Vercel redeploy.
import "server-only";

const API = "https://api.github.com";

export class GitHubPublishError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GitHubPublishError";
  }
}

type Args = {
  token: string;
  /** "owner/name" */
  repo: string;
  branch?: string;
  path: string;
  content: string;
  message: string;
  fetch?: typeof globalThis.fetch;
};

export async function publishFile({
  token,
  repo,
  branch = "main",
  path,
  content,
  message,
  fetch = globalThis.fetch,
}: Args): Promise<{ commitSha: string; commitUrl: string }> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const url = `${API}/repos/${repo}/contents/${path}`;
  const fail = async (res: Response) => {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    const text = (body.message ?? `GitHub returned HTTP ${res.status}`).replaceAll(token, "[redacted]");
    return new GitHubPublishError(text, res.status);
  };

  const current = await fetch(`${url}?ref=${branch}`, { headers });
  if (!current.ok && current.status !== 404) throw await fail(current);
  const sha = current.ok ? ((await current.json()) as { sha: string }).sha : undefined;

  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({ message, content: Buffer.from(content, "utf8").toString("base64"), branch, sha }),
  });
  if (!res.ok) throw await fail(res);
  const { commit } = (await res.json()) as { commit: { sha: string; html_url: string } };
  return { commitSha: commit.sha, commitUrl: commit.html_url };
}
