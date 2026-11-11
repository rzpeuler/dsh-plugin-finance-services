# A-share source Adapter candidates (FPROV-01)

This private Host-plugin package demonstrates three independent `financeData.registerAdapter()` registrations: `ashare-eastmoney-price`, `ashare-ths-consensus`, and `ashare-tdx-daily-package`. Each has its own `sourceId`, metadata, validator, status source and unregister disposer. It does not modify the main Financial Services Bundle or register data in Agent code.

## Fail-closed boundaries

- Adapter metadata uses `licenseClass: "UNASSESSED"`; every adapter starts with an empty ordinary-equity symbol allowlist unless the trusted Host plugin configuration explicitly supplies one (maximum 20 symbols). Ticker syntax alone does not prove ordinary-share eligibility.
- The FinanceData registry separately requires an exact direct financial-source grant and a Host-persisted `LicenseAssessment` for source, exact Agent/Session scope, role, capability, market, purpose and temporal mode. `UNKNOWN`/`REVIEW_REQUIRED`, restricted, denied, expired, or processing-incompatible assessments block before `validate/query` and before network/file access. A direct grant is not an MCP allowlist entry.
- Anonymous `authenticationMode: "NONE"` only describes login requirements; it does not establish a license. Session logging, model processing, automated access, retention and redistribution must be affirmatively reviewed. The default source matrix remains unverified.
- No cookies, keys, OAuth tokens, customer files, source response bodies or raw provider errors are logged or included in references. HTTP URLs are fixed in source code, GET-only, redirect-rejecting, credential-omitting, one request at a time, with a 10-second timeout and an 8 MB response cap. No retries or broad instrument enumeration are implemented.
- All three declare `CURRENT_OBSERVED` only. Current-source daily bars and current THS consensus cannot satisfy strict historical replay or be presented as historical consensus snapshots. A request must explicitly use `current_only` and a fresh `asOf`. The package does not claim strict PIT, long history, minutes, intraday data, or whole-market completeness.

## Coverage

| Adapter | Read path | Declared scope | Explicit limitations |
|---|---|---|---|
| Eastmoney | Fixed `push2his.eastmoney.com` daily K-line endpoint, `fqt=0` | One selected SH/SZ equity and one requested day; OHLC in CNY/share | No BJ secid mapping, no volume/amount until unit conversion is separately verified, no multiple-day series under the current observation contract, no strict historical revisions or adjustment factors |
| THS | Fixed `basic.10jqka.com.cn/new/{code}/worth.html` HTML page | One selected audited 600519.SH annual EPS aggregate row, only when a table explicitly identifies an aggregate/consensus EPS header | No broker-row substitution, no arbitrary symbols, no historical consensus snapshots. If current page structure lacks the specific header, returns `CAPABILITY_UNSUPPORTED` rather than guessing |
| TDX | Local explicitly configured `<YYYYMMDD>.zip`; official `g4day` package parser | Configured symbols, one package date, raw OHLC in CNY/share | No TCP quotation, no HTTP package download, no minute/tick data, no volume/amount output, no package directory scan. The caller must identify the directory and have source rights |

The current FinanceData observation schema binds every observation to the request period and cannot faithfully encode a daily series with a distinct trading date per row. Eastmoney and TDX therefore deliberately accept a single-day period; multi-day series is a `CAPABILITY_GAP`, not silently emitted as one observation.

## Installation / configuration

The package is `private` and `UNLICENSED`; do not publish it as a data product. Install only through the native Plugin Manager in a Host that provides FinanceData. Its plugin Config has `ordinaryEquitySymbols` (default `[]`, maximum 20 validated ticker strings) and `tdxPackageDirectory` (default empty); configure only via trusted local Plugin Manager settings. The TDX parser reads only the exact `<YYYYMMDD>.zip` requested and validates that the resolved file remains beneath the configured directory. HTTP download is intentionally not implemented while automated-access terms are unverified.

No real Agent query or source data is authorized by this example. Offline parser fixtures exercise field mapping only. To permit a production query, a trusted reviewer must independently verify official terms or contract evidence and configure a valid LicenseAssessment; merely seeing a public webpage or `READY` status is insufficient. The plugin cannot verify the substance of that evidence automatically.
