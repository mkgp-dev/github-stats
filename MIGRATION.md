# Migration Guide: Python v1 to JavaScript v2

## Breaking change

- `COUNT_STATS_FROM_FORKS` is removed from configuration semantics and should not be used.
- Use explicit scope controls instead:
  - `REPO_SCOPE` for repo/stars/forks scope.
  - `LANG_SCOPE` for language scope.

## New defaults

- `REPO_SCOPE=owned`
- `LANG_SCOPE=owned_plus_contributed`
- `ENABLE_LINES_CHANGED=false`
- `LINES_CHANGED_MAX_REPOS=30`
- `LINES_CHANGED_TIMEOUT_MS=20000`
- `LINES_CHANGED_MODULE_BUDGET_MS=120000`
- `LINES_CHANGED_MAX_RETRIES=5`
- `REQUEST_TIMEOUT_MS=15000`
- `MAX_CONCURRENCY=10`
- `MAX_RETRIES=5`

## Notes

- Workflow runtime is now Node.js (`actions/setup-node`, `npm ci`, `npm run generate`).
- `GITHUB_ACTOR` comes from `${{ github.actor }}` in Actions.
- Views are always computed from owned repositories.
- `lines_changed` remains optional and degrades as partial instead of failing the full run.
