# 2. Free Kite Personal API + NSE bhavcopy for prices

**Status:** accepted (2026-09-26)

There is no paid subscription. The free Kite Personal API covers holdings, funds and profile, but excludes all market data (https://kite.trade/forum/discussion/14868).

**Decision:** prices come from NSE's official end-of-day UDiFF bhavcopy.
- A scheduled GitHub Action fetches it and commits `data/prices.json` with ~75 sessions of close, volume, traded value and series for every candidate.
- The reference price is the last **close**. There is no live LTP.
- Tradability (series `EQ`) also comes from the bhavcopy.
- Kite is used only for login, holdings and margins.

**Consequences:**
- No Kite market data is displayed, so the data-vending terms don't apply.
- There are no candle-fetch or rate-limit concerns at runtime.
- Prices can be up to one session old, and the UI labels them "as of".
