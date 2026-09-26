import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { configProblems } from "./config";

const complete = {
  KITE_API_KEY: "k",
  KITE_API_SECRET: "s",
  KITE_USER_ID: "AB1234",
  TOKEN_ENC_KEY: randomBytes(32).toString("base64"),
  UPSTASH_REDIS_REST_URL: "https://x.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "t",
};

describe("configProblems (production)", () => {
  it("accepts a complete configuration", () => {
    expect(configProblems(complete)).toEqual([]);
  });

  it("accepts Upstash provisioned through the Vercel Marketplace (KV_* names)", () => {
    const marketplace = { ...complete, UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined };
    expect(configProblems({ ...marketplace, KV_REST_API_URL: "https://x.upstash.io", KV_REST_API_TOKEN: "t" })).toEqual([]);
  });

  it("names every missing variable, never a value", () => {
    expect(configProblems({ KITE_API_SECRET: "super-secret" })).toEqual([
      "KITE_API_KEY missing",
      "KITE_USER_ID missing",
      "TOKEN_ENC_KEY missing",
      "Upstash Redis missing (UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN)",
    ]);
  });

  it("rejects an encryption key that is not 32 bytes of base64", () => {
    expect(configProblems({ ...complete, TOKEN_ENC_KEY: "too-short" })).toEqual(["TOKEN_ENC_KEY must be 32 bytes, base64"]);
  });

  it("refuses the mock Kite in production", () => {
    expect(configProblems({ ...complete, KITE_MOCK: "1" })).toEqual(["KITE_MOCK must not be set in production"]);
  });
});

describe("publishingRepo", () => {
  it("uses the repo Vercel deployed from, or GITHUB_REPO", async () => {
    const { publishingRepo } = await import("./config");
    expect(publishingRepo({ VERCEL_GIT_REPO_OWNER: "me", VERCEL_GIT_REPO_SLUG: "basket" })).toBe("me/basket");
    expect(publishingRepo({ GITHUB_REPO: "me/other", VERCEL_GIT_REPO_OWNER: "me", VERCEL_GIT_REPO_SLUG: "basket" })).toBe("me/other");
    expect(publishingRepo({ GITHUB_REPO: "not a repo" })).toBeNull();
    expect(publishingRepo({})).toBeNull();
  });
});
