// Production configuration check. Reports variable names only, never values.
type Env = Record<string, string | undefined>;

export function hasUpstash(env: Env): boolean {
  return Boolean(
    (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) || (env.KV_REST_API_URL && env.KV_REST_API_TOKEN),
  );
}

export function configProblems(env: Env): string[] {
  const problems: string[] = [];
  if (env.KITE_MOCK === "1") problems.push("KITE_MOCK must not be set in production");
  for (const name of ["KITE_API_KEY", "KITE_API_SECRET", "KITE_USER_ID"]) {
    if (!env[name]) problems.push(`${name} missing`);
  }
  if (!env.TOKEN_ENC_KEY) problems.push("TOKEN_ENC_KEY missing");
  else if (Buffer.from(env.TOKEN_ENC_KEY, "base64").length !== 32) problems.push("TOKEN_ENC_KEY must be 32 bytes, base64");
  if (!hasUpstash(env)) problems.push("Upstash Redis missing (UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN)");
  return problems;
}

/** "owner/name" to publish lists to: GITHUB_REPO, else the repo Vercel deployed from. */
export function publishingRepo(env: Env): string | null {
  const repo =
    env.GITHUB_REPO ??
    (env.VERCEL_GIT_REPO_OWNER && env.VERCEL_GIT_REPO_SLUG ? `${env.VERCEL_GIT_REPO_OWNER}/${env.VERCEL_GIT_REPO_SLUG}` : "");
  return /^[\w.-]+\/[\w.-]+$/.test(repo) ? repo : null;
}
