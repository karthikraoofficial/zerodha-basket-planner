# 3. Buy-limit tick rounding = max(₹0.05, NSE band tick)

**Status:** accepted (2026-09-26)

The spec says to round the limit down to the tick size, "default ₹0.05". NSE ticks are banded by price:
- < ₹250: 0.01
- ₹250–1,000: 0.05
- ₹1,000–5,000: 0.10
- ₹5,000–10,000: 0.50
- ₹10,000–20,000: 1.00
- above that: 5.00

Flat 0.05 produces invalid prices above ₹1,000. The exact 0.01 tick changes the 24 Sep golden fixture (GPPL 166.10 → 166.12).

**Decision:** round down to `max(₹0.05, band tick)`. Every result is a valid NSE price, and the golden fixture reproduces exactly.
