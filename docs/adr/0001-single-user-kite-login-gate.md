# 1. Single user; Kite login is the app gate

**Status:** accepted (2026-09-26)

Every Kite Connect app is bound to its creator's Zerodha client ID ("All Kite Connect apps are bound to one client id. You can't use it with another account", https://kite.trade/forum/discussion/3935). Serving other Zerodha clients needs exchange approval (Kite Connect terms §3), and the terms say API credentials are for the owner only (§4b).

**Decision:** the app has one user. There is no Auth.js. Step 1 is the Kite login itself. The OAuth callback rejects any `user_id` other than `KITE_USER_ID`, and a server-side session in Redis holds the encrypted access token.

**Consequence:** if friends want to use it, each self-hosts a fork with their own Kite app.
