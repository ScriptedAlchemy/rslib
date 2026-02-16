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
