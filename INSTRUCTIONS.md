# Instructions

This guide explains how to set up and use this repository to generate transparent GitHub stats SVG files via GitHub Actions.

## Setup steps

1. Create your `ACCESS_TOKEN`:
   - Go to `Settings` -> `Developer settings` -> `Personal access tokens` -> `Tokens (classic)`.
   - Create a token with scopes: `repo` and `read:user`.
   - You may choose an expiration date or no expiration.
   - Copy the token immediately after creation; GitHub shows it only once.

2. Fork this repository.

3. In your fork, go to:
   - `Settings` -> `Secrets and variables` -> `Actions`
   - Click `New repository secret`.

4. Create required secrets:
   - `ACCESS_TOKEN`: token from step 1.
   - `GH_STATS_ACTOR`: your GitHub username/login.
     - Example: if your profile is `github.com/mkgp-dev`, set `GH_STATS_ACTOR` to `mkgp-dev`.
   - Optional secrets may also be added if you want custom behavior (see the `Optional secrets` section below for exact names and values to set).

5. Enable workflow write access:
   - Go to `Settings` -> `Actions` -> `General`.
   - Scroll to `Workflow permissions`.
   - Select `Read and write permissions`.
   - Save.

6. Run the workflow:
   - Go to `Actions`.
   - Select `Generate Stats Images`.
   - Click `Run workflow`.

7. Verify output:
   - A branch named `output` should be created.
   - Generated files are in:
     - `generated/overview.svg`
     - `generated/languages.svg`

## Optional secrets

- `REPO_SCOPE`: `owned` or `owned_plus_contributed`
- `LANG_SCOPE`: `owned` or `owned_plus_contributed`
- `ENABLE_LINES_CHANGED`: `true` or `false`
- `LINES_CHANGED_MAX_REPOS`
- `LINES_CHANGED_TIMEOUT_MS`
- `LINES_CHANGED_MODULE_BUDGET_MS`
- `LINES_CHANGED_MAX_RETRIES`
- `EXCLUDED_REPOS`: comma-separated `owner/repo`
- `EXCLUDED_LANGS`: comma-separated language names

Workflow fallback defaults are applied for:
- `REPO_SCOPE=owned`
- `LANG_SCOPE=owned_plus_contributed`
- `ENABLE_LINES_CHANGED=false`
