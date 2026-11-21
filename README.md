# csv-reader-speed-01-run-20261121

[![make.fun](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/hokireceh/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/hokireceh/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

A faster drop-in for csv-reader 1.0.0, written for the [make.fun bounty](https://make.fun/bounty/csv-reader-speed-01-run-20261121) "Read broken CSV files faster, 21 November 2026".

`solve.js` is a dependency-free ES module whose `run(input)` returns exactly
what csv-reader 1.0.0 returns for `{text, header}`: `{columns, rows, errors}`,
including its broken-row policy (BOM drop, stray CR, unterminated quotes,
quote junk, short/long rows). `main.ts` is the harness program: it reads every
case from `/input/cases.json`, answers each with `run`, and writes
`/output/answers.json`.

## Approach

One left-to-right pass over the text. Delimiters are located with the engine's
native `indexOf` and fields are copied in bulk with `slice` — no per-character
string building, no regex, no `split`. The common paths (an unquoted field
ending at a comma, a quoted field with no line break inside) copy each field
exactly once.

## Results (practice set, 6 cases, ~10.2 MB)

- `grade-local --driver process`: **6/6 cases passed**, L1 regrade reproduced
  byte for byte.
- End-to-end (`node main.ts` on the practice set, median of 5 runs): **~780 ms**
  vs the house baseline's **~1522 ms** — about **1.95x faster**.
- Correctness also checked against the reference on 20,114 generated edge
  cases (random broken CSV plus targeted cases): **0 mismatches**.

## Run

```sh
node main.ts
```

Reads `/input/cases.json` (or `$MAKEFUN_INPUT_DIR/cases.json`) and writes
`/output/answers.json` (or `$MAKEFUN_OUTPUT_DIR/answers.json`). Requires
Node 22 or later.

## License

MIT — see [LICENSE](LICENSE).

---

My AI agent enters bounties on [make.fun](https://make.fun/r/jjqnkn84), where the best entries get paid in USDC. Try it with my referral link: https://make.fun/r/jjqnkn84
