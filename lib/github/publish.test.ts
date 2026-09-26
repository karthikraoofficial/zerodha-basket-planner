import { describe, expect, it, vi } from "vitest";
import { GitHubPublishError, publishFile } from "./publish";

const TOKEN = "github_pat_SECRET123";

function fakeFetch(respond: (url: string, init: RequestInit) => { status: number; body: unknown }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const { status, body } = respond(String(url), init ?? {});
    return new Response(JSON.stringify(body), { status });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const args = (fetch: typeof globalThis.fetch) => ({
  token: TOKEN,
  repo: "owner/basket",
  path: "data/latest.json",
  content: '{"screen_date":"2026-09-28"}\n',
  message: "Update ranked list for 2026-09-28",
  fetch,
});

describe("publishFile (GitHub contents API)", () => {
  it("replaces an existing file on main in one commit", async () => {
    const { fetch, calls } = fakeFetch((_url, init) =>
      init.method === "PUT"
        ? { status: 200, body: { commit: { sha: "abc123", html_url: "https://github.com/owner/basket/commit/abc123" } } }
        : { status: 200, body: { sha: "oldsha" } },
    );
    const result = await publishFile(args(fetch));

    expect(result).toEqual({ commitSha: "abc123", commitUrl: "https://github.com/owner/basket/commit/abc123" });
    expect(calls[0]!.url).toBe("https://api.github.com/repos/owner/basket/contents/data/latest.json?ref=main");
    const put = calls[1]!;
    expect(put.init.method).toBe("PUT");
    expect(new Headers(put.init.headers).get("Authorization")).toBe(`Bearer ${TOKEN}`);
    const body = JSON.parse(String(put.init.body));
    expect(body).toMatchObject({ message: "Update ranked list for 2026-09-28", sha: "oldsha", branch: "main" });
    expect(Buffer.from(body.content, "base64").toString("utf8")).toBe('{"screen_date":"2026-09-28"}\n');
  });

  it("creates the file when it does not exist yet", async () => {
    const { fetch, calls } = fakeFetch((_url, init) =>
      init.method === "PUT"
        ? { status: 201, body: { commit: { sha: "new1", html_url: "u" } } }
        : { status: 404, body: { message: "Not Found" } },
    );
    await publishFile(args(fetch));
    expect(JSON.parse(String(calls[1]!.init.body)).sha).toBeUndefined();
  });

  it("reports GitHub's refusal without leaking the token", async () => {
    const { fetch } = fakeFetch((_url, init) =>
      init.method === "PUT"
        ? { status: 403, body: { message: `Resource not accessible by personal access token ${TOKEN}` } }
        : { status: 200, body: { sha: "s" } },
    );
    const error = await publishFile(args(fetch)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GitHubPublishError);
    expect((error as GitHubPublishError).status).toBe(403);
    expect(JSON.stringify(error, Object.getOwnPropertyNames(error))).not.toContain(TOKEN);
  });
});
