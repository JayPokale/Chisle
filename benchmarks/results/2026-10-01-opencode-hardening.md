# OpenCode hardening replay — 2026-10-01

Deterministic synthetic replay, Node 22.22.2 on Ubuntu 24.04 (WSL). Compared
the original PR commit `1e14a38` with its review fixes. No model calls or token
measurements; this receipt establishes character bounds and preserved content.

| Fixture | Original PR | Review fixes |
|---------|------------:|-------------:|
| 100 characters, configured bound 1 | 100, unchanged | 1 |
| Repeated session output, configured bound 1,000 | 1,613 | 1,000 |
| Late diagnostic, configured bound 1,000 | diagnostic lost | diagnostic retained |

The late-diagnostic fixture retains `BEGIN` and `END` in both versions. Its
recovery spill matches the original bytes in both versions. Fixtures and
assertions live in `tests/test_opencode.js`; direct shared-core Unicode and
late-error regressions live in `tests/test_compress.js`.

An ordinary ASCII build-log replay remains byte-identical across `main`
(`41e7cef`), original PR, and review fixes: 37,164 → 9,177 characters, both
warnings retained. Fixture: 411 lines of `build ${i} ${'x'.repeat(80)}` joined
with newlines; replace zero-based lines 120 and 280 with
`WARNING: replay warning one` and `WARNING: replay warning two`, then call
`transform(text, THRESHOLDS)` without a tool name or spill path.

Verification:

```bash
node --test tests/test_compress.js tests/test_opencode.js  # 67 passed
node --test tests/*.js                                   # 197 passed
node scripts/build-rules.js --check
node scripts/build-chart.js --check
node scripts/build-samples.js --check
```

All checks passed, plus shell syntax and installer list/help smoke checks.
This replay does not establish live OpenCode lifecycle behavior or model savings.
