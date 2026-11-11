# FPROV-01 Adapter, authorization and temporal contracts

Version: **1.0.0 additive compatibility contract** (FinanceData canonical API)

## 1. Adapter identity and grant types

An Adapter registers a strict `metadata` object and its own `validate(query, execution)`, `query(query, execution)`, observable state and exact unregister disposer through `financeData.registerAdapter()`. Registration only places that identity in the Host catalog. It does not create access rights.

The persisted `SourceBinding` format remains one array and accepts two disjoint forms:

- **Legacy MCP source binding**: `sourceAllowlistKey` only. It retains the original role `allowedMcpServers` intersection and the existing per-query validation semantics. Legacy records parse unchanged; the new source path never converts, imports or treats these values as source grants.
- **Direct financial-source grant**: `sourceId` only plus a `licenseAssessment`. Host policy intersects exact Adapter ID and source ID, exact scope, non-writer role, capability, market, purpose and temporal mode. Role MCP allowlists are neither consulted nor modified. An omitted binding means deny.

Each direct binding must constrain the assessment to the exact source and only capabilities/purposes within that binding. The adapter identity is matched to `metadata.sourceId`; `query.sourceIds` remains a post-authorization preference only. Writers are always denied. Default policy contains zero bindings and source adapters have no implicit role/scope grants.

## 2. LicenseAssessment v1

A direct grant carries this strict, versioned shape:

```json
{
  "version": 1,
  "sourceId": "eastmoney",
  "assessmentStatus": "REVIEW_REQUIRED",
  "evidenceRefs": [],
  "allowedPurposes": ["research"],
  "capabilityIds": ["prices.history"],
  "automatedAccess": false,
  "modelProcessing": false,
  "sessionLogging": false,
  "retention": "UNKNOWN",
  "redistribution": "UNKNOWN",
  "reviewedAt": null,
  "expiresAt": null
}
```

Statuses are `UNKNOWN`, `REVIEW_REQUIRED`, `VERIFIED`, `RESTRICTED`, or `DENIED`. Evidence references are credential-free HTTPS/URN references. A schema-valid `VERIFIED` assessment requires at least one evidence reference, a nonempty allowed-purpose list, all three processing permissions and known retention/redistribution terms. However, the current Host has no trusted reviewer-principal/source-attestation API: the Client UI does not offer `VERIFIED`, and the Host rejects remote `VERIFIED` writes. A terms URL, permission checkbox or Client timestamp is an unverified claim, not a supplier grant. Existing persisted direct-source `VERIFIED` claims are shown as `REVIEW_REQUIRED` in memory without rewriting the saved record. In this implementation, `VERIFIED` is reserved for isolated Registry test fixtures; no production source can be enabled through the current UI.

For every direct non-TEST_ONLY query the Host validates the current assessment against source, capability and purpose; all three rights (`automatedAccess`, `modelProcessing`, `sessionLogging`) must be true. Unknown/review-required returns `LICENSE_REVIEW_REQUIRED`; restricted/denied or an incompatible use returns `LICENSE_USE_NOT_AUTHORIZED`; expiry returns `LICENSE_ASSESSMENT_EXPIRED`. These checks run before Adapter validation/query, network or file access. The Host does not stamp Client claims as reviewed: remote `VERIFIED` writes are rejected until a trusted Host reviewer flow exists. Existing Adapter-returned permission booleans remain accepted only on the legacy path; an Adapter cannot upgrade a direct grant by returning booleans.

`licenseClass` is descriptive, not an authorization primitive. `UNASSESSED` distinguishes anonymous reachability from verified license classes. `authenticationMode` (`NONE`, `API_KEY`, `OAUTH`, `USER_FILE`, `OTHER`) is separate. `NONE` means no login was needed; it does not imply licensed access. Adapter state and connection/authentication observations are shown separately from registration and LicenseAssessment status.

## 3. PIT v1 additive temporal quality

The existing `temporalMode` (`strict`, `date_bounded`, `current_only`) stays unchanged. Optional `researchIntent` is `historicalReplay` or `currentResearch`; absent intent keeps existing behavior, with `strict`/`date_bounded` treated as historical and `current_only` treated as current research. Explicit `historicalReplay + current_only` and `currentResearch + non-current_only` are rejected.

Adapters may declare `pitQualities`: `STRICT_HISTORICAL`, `CURRENT_OBSERVED`, `RECONSTRUCTED`, `UNVERIFIED`. Old metadata safely maps `strict`/`date_bounded` to `STRICT_HISTORICAL` and `current_only` to `CURRENT_OBSERVED`, but existing timestamp, revision-chain, chronology and freshness checks still run. Observation-level `pitQuality` is additive; absent values are inferred from existing evidence. Historical replay requires `STRICT_HISTORICAL` and stable non-reconstructed source revision evidence. A current snapshot, reconstructed result or unknown evidence cannot satisfy history. Current-source data preserves the exact retrieval/capture time and cannot be backdated to an earlier consensus or availability timestamp.

`prices.history` currently cannot represent a daily series whose individual rows each have a different trading date: each observation period must match the Query period. The FPROV-01 examples therefore use a one-day period and do not pretend to return a multi-day series. A multi-day time-series contract requires a later additive capability/schema decision.

## 4. A-share candidate package limits

Three separate Adapter IDs are provided under `examples/ashare-adapters/`: Eastmoney `push2his` raw daily OHLC, THS aggregate annual EPS page, and TDX official dated package local-file parser. All are `UNASSESSED`, unregistered in the current Profile, authentication is distinct, ordinary-share allowlists default empty, and all temporal declarations are `CURRENT_OBSERVED`. No third-party data is returned to a production Agent: direct source queries remain blocked because no trusted Host review path or source grant exists; Registry tests use only synthetic, simulated review fixtures. TDX download is deliberately disabled; only the exact date-named local ZIP under a trusted configured directory can be opened. Unsupported units, symbols, dates or HTML structures are refused rather than guessed.

## 5. Migration and compatibility

- Existing policy roots `{revision, bindings}` remain valid; the `bindings` array is unchanged at the storage/Remote level and old MCP binding objects remain valid under the optional direct-source fields.
- Existing adapters need not declare `authenticationMode`, `pitQualities`, or observation `pitQuality`. They retain strict parsing and existing safeguards. Existing Adapter validation booleans are not removed.
- Direct source grants are an opt-in new binding form. No old binding is translated to `sourceId`; old MCP allowlists do not become financial data grants.
- The model-facing tool and DSH Core are unchanged. Remote control-plane methods stay user-facing; Agent query remains on the existing Host-only `finance_data_query` path.
