// The only Kite Connect calls this app may make (ADR 0004). Read-only apart from creating and
// destroying its own login session. Adding anything here needs a very good reason.
export const ALLOWED_KITE_CALLS: readonly { method: string; path: string }[] = [
  { method: "POST", path: "/session/token" },
  { method: "DELETE", path: "/session/token" },
  { method: "GET", path: "/user/profile" },
  { method: "GET", path: "/portfolio/holdings" },
  { method: "GET", path: "/user/margins/equity" },
];
