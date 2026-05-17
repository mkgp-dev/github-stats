# github-stats

Automatically generate transparent GitHub stats SVG cards using a Node.js runtime.

## Local usage

1. Install dependencies: `npm ci`
2. Set required environment variables
3. Run generator: `npm run generate`

## Required secret

- `ACCESS_TOKEN`: GitHub personal access token used for API access.
- `GH_STATS_ACTOR`: GitHub login that owns the `ACCESS_TOKEN` PAT (used for `GITHUB_ACTOR`).

## Optional secrets

- `REPO_SCOPE`: `owned` or `owned_plus_contributed` (default: `owned`; workflow fallback applied when secret is unset)
- `LANG_SCOPE`: `owned` or `owned_plus_contributed` (default: `owned_plus_contributed`; workflow fallback applied when secret is unset)
- `ENABLE_LINES_CHANGED`: `true` or `false` (default: `false`; workflow fallback applied when secret is unset)
- `LINES_CHANGED_MAX_REPOS`
- `LINES_CHANGED_TIMEOUT_MS`
- `LINES_CHANGED_MODULE_BUDGET_MS`
- `LINES_CHANGED_MAX_RETRIES`
- `EXCLUDED_REPOS`: comma-separated `owner/repo` values
- `EXCLUDED_LANGS`: comma-separated language names

See [MIGRATION.md](MIGRATION.md) for upgrade and compatibility notes.

## Credits

- [rahul-jha98/github-stats-transparent](https://github.com/rahul-jha98/github-stats-transparent)
