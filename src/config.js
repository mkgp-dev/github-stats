const VALID_SCOPE = new Set(['owned', 'owned_plus_contributed']);

function requireString(env, key) {
  const value = env[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} is required and must be a non-empty string`);
  }
  return value.trim();
}

function parseBool(env, key, fallback) {
  const raw = env[key];
  if (raw == null || raw === '') return fallback;
  const norm = String(raw).trim().toLowerCase();
  if (norm === 'true') return true;
  if (norm === 'false') return false;
  throw new Error(`${key} must be true or false`);
}

function parseIntValue(env, key, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const raw = env[key];
  if (raw == null || raw === '') return fallback;
  const normalized = String(raw).trim();
  if (!/^[+-]?\d+$/.test(normalized)) {
    throw new Error(`${key} must be an integer between ${min} and ${max}`);
  }
  const value = Number.parseInt(normalized, 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${key} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function parseScope(env, key, fallback) {
  const value = (env[key] ?? fallback).trim();
  if (!VALID_SCOPE.has(value)) {
    throw new Error(`${key} must be one of: owned, owned_plus_contributed`);
  }
  return value;
}

function parseSet(env, key) {
  const raw = env[key] ?? '';
  return new Set(raw.split(',').map((x) => x.trim()).filter(Boolean));
}

function parseMetricOwners(env, githubActor) {
  const raw = env.METRIC_OWNERS ?? githubActor;
  return new Set(raw.split(',').map((x) => x.trim()).filter(Boolean));
}

export function loadConfig(env = process.env, logger = console) {
  const accessToken = requireString(env, 'ACCESS_TOKEN');
  const githubActor = requireString(env, 'GITHUB_ACTOR');

  if ('COUNT_STATS_FROM_FORKS' in env) {
    logger.warn(
      '[WARN] COUNT_STATS_FROM_FORKS is no longer supported and has been ignored. Use REPO_SCOPE/LANG_SCOPE.'
    );
  }

  const config = {
    accessToken,
    githubActor,
    repoScope: parseScope(env, 'REPO_SCOPE', 'owned'),
    langScope: parseScope(env, 'LANG_SCOPE', 'owned_plus_contributed'),
    enableLinesChanged: parseBool(env, 'ENABLE_LINES_CHANGED', false),
    linesChangedMaxRepos: parseIntValue(env, 'LINES_CHANGED_MAX_REPOS', 30),
    linesChangedTimeoutMs: parseIntValue(env, 'LINES_CHANGED_TIMEOUT_MS', 20000),
    linesChangedModuleBudgetMs: parseIntValue(env, 'LINES_CHANGED_MODULE_BUDGET_MS', 120000),
    linesChangedMaxRetries: parseIntValue(env, 'LINES_CHANGED_MAX_RETRIES', 5),
    requestTimeoutMs: parseIntValue(env, 'REQUEST_TIMEOUT_MS', 15000),
    maxConcurrency: parseIntValue(env, 'MAX_CONCURRENCY', 10, 1, 50),
    maxRetries: parseIntValue(env, 'MAX_RETRIES', 5, 1, 10),
    metricOwners: parseMetricOwners(env, githubActor),
    excludedRepos: parseSet(env, 'EXCLUDED_REPOS'),
    excludedLangs: parseSet(env, 'EXCLUDED_LANGS')
  };

  return Object.freeze(config);
}
