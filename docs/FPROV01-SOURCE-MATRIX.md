# FPROV-01 A-share source matrix

## Evidence boundary

A separate, bounded, single-session source audit was performed outside this repository. Its working folder and raw/sanitized evidence package are not present in this checkout and have not been copied here. The summary below records only the scope and outcome needed for this integration; it contains no source payloads, row values, credentials, or raw response hashes. The earlier audit is not a current availability check, legal review, broad coverage study, or strict point-in-time proof. This integration made **no real upstream requests**.

Public endpoint identities are listed so the implementations can be reviewed. A reachable public page or anonymous HTTP response does not grant permission for automated access, model processing, logging/retention, or redistribution.

| Adapter / source | Declared capability and narrow scope | Public endpoint / input | Auth vs permission | Temporal claim | Current implementation and status |
|---|---|---|---|---|---|
| `ashare-eastmoney-price` / `eastmoney` | `prices.history`: one-day unadjusted OHLC, CNY/share; only an explicitly allowlisted `.SH` or `.SZ` ordinary-equity symbol | [Eastmoney daily K-line endpoint](https://push2his.eastmoney.com/api/qt/stock/kline/get); single date, `fqt=0` | Anonymous HTTP (`NONE`) is not entitlement. License and processing rights are `UNASSESSED`; no direct source grant exists. | `CURRENT_OBSERVED`; source revision chain and historical PIT not established. Multi-day series intentionally unsupported. | Bounded external audit previously observed a near-window response. Offline parser/fetch-mock tests cover mapping and deny paths; **no live Adapter query**. BJ is rejected. |
| `ashare-ths-consensus` / `ths` | `earnings.consensus`: annual aggregate EPS per share; restricted to exact `600519.SH`, only when explicitly allowlisted | [THS basic stock page](https://basic.10jqka.com.cn/new/600519/worth.html); parser requires an explicit aggregate/consensus EPS header and year row | Anonymous HTTP (`NONE`) is not entitlement. License and processing rights are `UNASSESSED`; no direct source grant exists. | `CURRENT_OBSERVED` page content only; no historical consensus vintages are asserted. | Bounded external audit previously observed the public page and annual rows. Offline parser and cross-market/no-fetch tests exist; **no live Adapter query**. `.SZ`/`.BJ` suffixes are refused even if misconfigured in the ordinary-equity allowlist. |
| `ashare-tdx-daily-package` / `tdx-daily-package` | `prices.history`: one-day unadjusted OHLC, configured symbols only; volume/amount omitted | [TDX official dated daily-package index](https://www.tdx.com.cn/products/data/data/g4day/); Adapter reads only exact `<YYYYMMDD>.zip` in a configured local directory and never downloads it | `USER_FILE` describes the input path only. Source and reuse permissions remain `UNASSESSED`; no direct source grant exists. | `CURRENT_OBSERVED`; a dated archive does not establish historical PIT or revision completeness. | The external audit previously parsed one official dated package. Current tests use a synthetic ZIP fixture; the user’s local files are not opened. No live Adapter query or network download. |

## Current source-policy state

- All three FPROV source IDs are `UNASSESSED`; no Adapter is registered in the current Profile, no source binding exists, and ordinary-equity allowlists default empty.
- The Host exposes no trusted reviewer-principal or source-license attestation API. A Client-entered `VERIFIED`, evidence URI, permission checkbox, or timestamp is not supplier authorization. Remote `VERIFIED` policy writes are rejected; older persisted Client claims are demoted to `REVIEW_REQUIRED` in the in-memory view without rewriting the saved record.
- Therefore source-data execution remains blocked. Only direct Registry unit fixtures simulate a verified assessment; they are not evidence of real permission or production authorization.
- The existing observation contract does not encode a trading date per row for a daily series. These adapters accept a single day and do not invent a multi-day series contract.

## Source-family deduplication and limits

Eastmoney `push2his` belongs to one provider/operator family; THS pages belong to one family; the TDX TCP product and official dated package belong to the same operator family. Separate Adapter IDs are software boundaries, not independent vendor corroboration. No adapter claims broader company coverage, volume/amount, historical financial statements, news, corporate actions, historical consensus vintages, strict PIT, or commercial redistribution.

Offline code tests: [A-share adapter tests](../tests/ashare-adapters.test.js), [Host policy tests](../tests/data-host.test.js), and [integration report](../acceptance/FINANCE-3A-FPROV-INTEGRATION-REPORT.md).