# FPROV-01 next decisions (deferred)

This list records future decisions only; no unanswered item is permission to enable access.

1. **Per-source license evidence:** obtain and review current official Terms or a valid contract for Eastmoney, THS, and TDX separately, covering automated access, financial research use, model processing, session logging/retention, and any redistribution. Until then, `UNASSESSED` remains blocked.
2. **Ordinary-share allowlists:** identify which ordinary A-share symbols each permitted role/scope may query. The adapter defaults stay empty; do not infer eligibility from ticker syntax or bulk-enumerate the market.
3. **Daily-series contract:** decide whether FinanceData needs a versioned time-series row/date model for multi-day OHLC, before expanding any Adapter beyond one-day periods.
4. **Price units:** review authoritative Eastmoney and TDX definitions for volume (shares vs lots), amount and date semantics; only then add those fields or conversion tests.
5. **THS consensus semantics:** verify the exact current consensus page header, unit and aggregation methodology, plus whether annual forecast periods may be used for the selected purposes. Keep the parser refusing unknown HTML and individual broker rows.
6. **TDX package source rights:** decide whether a user-provided/local package is the only permitted route or whether official automated download is expressly permitted. Current implementation downloads no TDX file and does not scan local directories.
