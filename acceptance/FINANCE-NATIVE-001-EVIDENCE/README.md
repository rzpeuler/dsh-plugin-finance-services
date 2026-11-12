# FINANCE-NATIVE-001 Evidence Index

Evidence is metadata-only and contains no Profile database, user Session text, credentials, secrets, or finance data.

- `environment.json`: observed runtime versions and execution boundary.
- `git-heads.json`: baseline/current Git facts.
- `install-lifecycle.json`: Plugin Manager baseline and why no state-changing native action was safe.
- `ui-matrix.csv`: native UI/registry items and actual observation status.
- `session-run-evidence.json`: no test Sessions/Runs were created.
- `worker-permissions-matrix.csv`: source/test declarations vs native E2E not run.
- `adapter-lifecycle.json`: adapter package declarations and no native lifecycle changes.
- `source-denials.json`: no real queries initiated; distinction between mocked tests and native invocation-level proof.
- `regression.json`: exact build/test/package command results from this run.
- Screenshots and native logs: none. The GUI was not controlled and the active Profile was intentionally left unchanged.

All existing assertion details are limited to what the recorded tool outputs, commands, or fixtures actually established. Native steps blocked by Profile safety are not inferred from static source or fixture tests.
