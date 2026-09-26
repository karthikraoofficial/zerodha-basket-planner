# 4. Direct, allow-listed Kite REST client instead of the kiteconnect SDK

**Status:** accepted (2026-09-26)

The official `kiteconnect` npm package is maintained, but its client exposes order placement, modification and GTT methods. This app needs five endpoints: session create and delete, profile, holdings and equity margins.

**Decision:** use a small in-repo client that refuses any method or path outside an explicit allow-list. The `kiteconnect` package is banned by ESLint and by the no-order-code test.

**Defence in depth:** no static IP is registered on the Kite app, so Zerodha rejects any order from this API key regardless (static IP is mandatory for API orders since 1 Apr 2026).
