import test from 'ava';
import { loadConfig } from '../src/config.js';

test('loadConfig throws when ACCESS_TOKEN is missing', (t) => {
  t.throws(() => loadConfig({ GITHUB_ACTOR: 'mkgp' }), { message: /ACCESS_TOKEN/ });
});

test('loadConfig throws when GITHUB_ACTOR is missing', (t) => {
  t.throws(() => loadConfig({ ACCESS_TOKEN: 'abc' }), { message: /GITHUB_ACTOR/ });
});

test('loadConfig applies defaults and parses booleans/ints', (t) => {
  const warnings = [];
  const cfg = loadConfig(
    {
      ACCESS_TOKEN: 'abc',
      GITHUB_ACTOR: 'mkgp',
      ENABLE_LINES_CHANGED: ' true ',
      LINES_CHANGED_MAX_REPOS: '42',
      COUNT_STATS_FROM_FORKS: '1'
    },
    { warn: (msg) => warnings.push(msg) }
  );

  t.is(cfg.repoScope, 'owned');
  t.is(cfg.langScope, 'owned_plus_contributed');
  t.deepEqual([...cfg.metricOwners], ['mkgp']);
  t.is(cfg.enableLinesChanged, true);
  t.is(cfg.linesChangedMaxRepos, 42);
  t.is(cfg.requestTimeoutMs, 15000);
  t.is(warnings.length, 1);
});

test('loadConfig uses default linesChangedMaxRepos when unset', (t) => {
  const cfg = loadConfig({ ACCESS_TOKEN: 'abc', GITHUB_ACTOR: 'mkgp' });
  t.is(cfg.linesChangedMaxRepos, 30);
  t.is(cfg.requestTimeoutMs, 15000);
  t.is(cfg.maxConcurrency, 10);
  t.is(cfg.maxRetries, 5);
  t.deepEqual([...cfg.metricOwners], ['mkgp']);
});

test('loadConfig parses METRIC_OWNERS allowlist', (t) => {
  const cfg = loadConfig({
    ACCESS_TOKEN: 'abc',
    GITHUB_ACTOR: 'mkgp',
    METRIC_OWNERS: ' mkgp, TerniLabs, , mkgp '
  });

  t.deepEqual([...cfg.metricOwners], ['mkgp', 'ternilabs']);
});

test('loadConfig rejects malformed integer env strings', (t) => {
  t.throws(
    () =>
      loadConfig({
        ACCESS_TOKEN: 'abc',
        GITHUB_ACTOR: 'mkgp',
        LINES_CHANGED_MAX_REPOS: '12abc'
      }),
    { message: /LINES_CHANGED_MAX_REPOS/ }
  );

  t.throws(
    () =>
      loadConfig({
        ACCESS_TOKEN: 'abc',
        GITHUB_ACTOR: 'mkgp',
        MAX_CONCURRENCY: '1.5'
      }),
    { message: /MAX_CONCURRENCY/ }
  );

  t.throws(
    () =>
      loadConfig({
        ACCESS_TOKEN: 'abc',
        GITHUB_ACTOR: 'mkgp',
        MAX_RETRIES: '1e3'
      }),
    { message: /MAX_RETRIES/ }
  );
});
