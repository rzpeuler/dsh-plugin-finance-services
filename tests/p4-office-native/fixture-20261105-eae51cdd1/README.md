# Native Office technical capability fixture

This unique package is **TECHNICAL_TEST_ONLY**, not FinanceRole or Worker E2E. It registers no tool, creates no Agent, changes no cwd/policy and starts no model/server. Its original SVG artwork is authored for this fixture (no third-party assets).

## Parent-only activation

- Install this package using the native Plugin Manager only after reviewing its trusted Config. The delegated author did not install it or generate Office files.
- `authorSessionId` is the parent's actually sampled managed `DSH_SESSION_ID` (parent supplied 2026-11-05), not an inferred delegation UUID. Activation resolves the exact live native Agent or refuses; there is no fallback identity.
- `primaryRuntimeSource` is a creator-observed installation-local binding validated by the public resolver at runtime, not an interpreter hardcoded in implementation. No system Python/download/install fallback exists.
- `runRoot` is fixed for this run beneath the native Session root. Existing run roots are rejected, never erased/reused. Native policy/effective cwd must stay unchanged; only a narrower workspace-write process root is requested.
- **Reviewed boundary:** installed Windows sandbox reports `partial` and owns a separate private temp tree. Parent explicitly accepted that native provider boundary for this technical probe, so trusted Config sets `acceptNativeProviderPrivateTempAndPartial:true`; false would stop before child spawn. This is not permission for a broader caller-chosen root. No promise of kernel-only-runRoot is made. Child TEMP/TMP/TMPDIR requests remain in own runRoot, but the native runner can supply its own private temp. No native provider/Core patch or unconfined retry.
- Declared public package dependencies are explicit. Parent's manager may need to prepare them; do not manually install packages or bypass build-script approval. No install script is supplied by this fixture.

## Expected evidence

After activation the context-owned asynchronous task saves an immutable report under the configured run root; unload aborts and joins managed children. If author/root admission fails before a safe root exists, a diagnostic report is logged rather than writing elsewhere.

Operations are separately PASSED/FAILED/NOT_RUN: public Python resolver, Kit offline discovery, fixed script digest, three-format creation/reopen, actual CLI recalculation, formula+cached 42 reopen, native Office-to-PDF, PDF signature/publication, and started-process intentional cancel/terminate/join. Recalculation failures never receive hand-filled caches. Native stdout/stderr inherit Host logs; no direct Node subprocess or named-pipe workaround is supplied. Every native child uses confined argv, fixed executable/arguments and a 1-second termination grace; ordinary operations have a 90-second timeout.

The producer is fixed self-authored Python using bundled libraries, with numeric inputs 17 and 25 and `=SUM(A2:A3)` expecting 42. Outputs explicitly say not financial work. It preserves source and staging files, uses exclusive private staging and complete-file no-replace hardlink publication for its own outputs. The Kit's recalculated output is separately retained as a technical staging result, not claimed atomic publication.

Native `officeToPdf` uses bounded version-checked author-owned bytes and its native provider-private scratch; source access and result disclosure are checked against the exact author. PDF validation is nonempty plus signature, not page/content/visual acceptance. Files and SHA records remain for parent verification; no history deletion.

This fixture does **not** pass P4-XLSX/DOCX/PPTX/PDF/PERM/LIFETIME business criteria, verify a FinanceRole grant, restore missing financial templates, or complete P3/P5/P6. Syntax checks are not native runtime evidence. Metadata/icon resources can be inspected statically; rendered Plugin Manager appearance remains unverified until parent activation.


Explicit technical binding route: public-library imports failed in linked fixtures; file-protocol dependency preparation timed out. Those failures remain archived. This attempt does NOT claim public package discovery/resolution. It uses installation-local paths explicitly supplied by the actual creator dependency Tool and Office recalculation skill, verifies the selected payload digest and executable mapping, and invokes the SAME installed Kit CLI under native confinement. OfficeSourceKey is the inspected public branded string type, not a runtime class; source identity remains explicit and bounded. No alternate engine, private resolver, guessed path or financial-role permission is used. This technical smoke cannot pass P4 business/runtime integration.


Startup diagnostic only: two fixed native-confined --version calls distinguish an observed process-start failure from Office imports or artifact logic. No unconfined retry, runner rewriting, ACL/Core modification, financial-role tools or Office result is claimed.
