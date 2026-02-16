---
'@rslib/core': minor
---

feat: add workspace `projects` orchestration mode for monorepos

- support root-level `projects` config to discover child Rslib projects
- support nested workspace project configs
- add dependency-aware build ordering based on local package dependencies
- add `--project` CLI filter (supports wildcard and negation patterns)
- support workspace mode for `rslib build` and `rslib inspect`
- add clear errors for unsupported workspace commands (`build --watch`, `mf-dev`)
- improve workspace config validation diagnostics (invalid `projects` shape and no-child matches include config path context)
- normalize workspace diagnostics for trimmed `projects` / `--project` values and validate empty negation patterns after `!`
- deduplicate no-child diagnostic patterns for repeated workspace project entries while preserving first-occurrence order
- deduplicate repeated `--project` filters in filter-miss diagnostics, report normalized filter patterns, and preserve first-occurrence order
- list available workspace projects in filter-miss diagnostics using deterministic sorted order
