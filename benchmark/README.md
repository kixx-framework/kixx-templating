# Phase 8 Benchmarks

This directory contains the Phase 8 benchmark suite from
`tmp/mustache-rewrite-design.md`.

Run the full suite:

```bash
npm run benchmark
```

Run a shorter smoke-test version:

```bash
npm run benchmark:quick
```

Both commands write a local report to `tmp/phase8-benchmark-report.md`. The `tmp/`
directory is intentionally ignored; this file records the latest checked decision.

## Locked Decisions

- **Output buffering:** keep the current return-string closure shape.
- **Scope representation:** keep explicit linked frames, `{ value, parent }`.

The benchmark threshold for changing a hot-path representation is a clear improvement
of more than 10%. Results below that threshold keep the simpler incumbent design.

## Latest Run

Environment:

- Date: 2026-06-08
- Node: v24.13.1
- Platform: darwin arm64
- Items per render: 250
- Samples: 5 x 250ms, warmup 100ms

Current engine workload medians:

| Benchmark | Ops/sec |
|-----------|--------:|
| array-section | 42,053 |
| map-section | 41,043 |
| object-section | 32,822 |
| deep-stack | 2,718,618 |
| helper-heavy | 36,877 |
| partial-heavy | 39,883 |

Candidate hot-path medians:

| Benchmark | Ops/sec | Decision |
|-----------|--------:|----------|
| return-string | 108,839 | Keep |
| writer-sink | 47,503 | Reject |
| linked-frames | 74,695 | Keep |
| prototype-copy | 73,086 | Reject |
| context-copy | 70,312 | Reject |

## Benchmark Scope

The suite has two layers:

- Current engine workloads compile and render representative templates through the
  public Kixx pipeline.
- Candidate hot-path benchmarks compare the unresolved implementation choices from the
  Phase 8 plan: return-string vs writer/sink output and linked frames vs prototype-copy
  scopes. They also include context-copy scopes to model the pre-rewrite `Object.assign`
  strategy.

Handlebars is not benchmarked here because it is not a project dependency. Adding it to
this repository's benchmark path would violate the zero-dependency constraint unless it
is deliberately vendored for benchmarking only.
