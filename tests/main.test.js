import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/main.js';

function baseConfig(overrides = {}) {
  return {
    accessToken: 'abc',
    githubActor: 'mkgp',
    repoScope: 'owned',
    langScope: 'owned_plus_contributed',
    enableLinesChanged: false,
    requestTimeoutMs: 1000,
    maxRetries: 2,
    maxConcurrency: 2,
    excludedRepos: new Set(),
    excludedLangs: new Set(),
    ...overrides
  };
}

function baseStats(overrides = {}) {
  return {
    name: 'MK',
    login: 'mkgp',
    stars: 1,
    forks: 1,
    contributions: 1,
    views: 1,
    repoCount: 1,
    languages: { JavaScript: { size: 1, occurrences: 1, color: '#f1e05a', prop: 100 } },
    linesChanged: null,
    ownedRepoNames: ['mkgp/owned'],
    repoNamesForLines: ['mkgp/owned', 'other/contrib'],
    ...overrides
  };
}

test('run validates viewer login before collecting stats', async () => {
  const calls = [];
  const deps = {
    loadConfig: () => baseConfig(),
    createClient: () => ({
      graphql: async () => ({ data: { viewer: { login: 'mkgp' } } })
    }),
    collectCoreStats: async () => {
      calls.push('collect');
      return baseStats();
    },
    renderOverview: async () => calls.push('overview'),
    renderLanguages: async () => calls.push('languages')
  };

  await run(deps);
  assert.deepEqual(calls.sort(), ['collect', 'languages', 'overview']);
});

test('run throws when token login mismatches configured actor', async () => {
  const deps = {
    loadConfig: () => baseConfig({ githubActor: 'mkgp' }),
    createClient: () => ({
      graphql: async () => ({ data: { viewer: { login: 'someone-else' } } })
    }),
    collectCoreStats: async () => {
      throw new Error('should not run collectCoreStats on login mismatch');
    }
  };

  await assert.rejects(() => run(deps), /Token login mismatch/);
});

test('run collects lines changed only when enabled and passes owned_plus_contributed list', async () => {
  const calls = [];
  const deps = {
    loadConfig: () => baseConfig({ enableLinesChanged: true, repoScope: 'owned_plus_contributed' }),
    createClient: () => ({
      graphql: async () => ({ data: { viewer: { login: 'mkgp' } } })
    }),
    collectCoreStats: async () => baseStats(),
    collectLinesChanged: async ({ repos, username }) => {
      calls.push(['lines', repos, username]);
      return { additions: 5, deletions: 2, isPartial: false };
    },
    renderOverview: async ({ stats }) => {
      calls.push(['overview', stats.linesChanged]);
    },
    renderLanguages: async () => {
      calls.push(['languages']);
    }
  };

  await run(deps);

  assert.deepEqual(calls[0], ['lines', ['mkgp/owned', 'other/contrib'], 'mkgp']);
  assert.deepEqual(calls[1], ['overview', { additions: 5, deletions: 2, isPartial: false }]);
});

test('run sets zero lines changed when disabled', async () => {
  let captured;
  const deps = {
    loadConfig: () => baseConfig({ enableLinesChanged: false }),
    createClient: () => ({
      graphql: async () => ({ data: { viewer: { login: 'mkgp' } } })
    }),
    collectCoreStats: async () => baseStats({ linesChanged: null }),
    renderOverview: async ({ stats }) => {
      captured = stats.linesChanged;
    },
    renderLanguages: async () => {}
  };

  await run(deps);
  assert.deepEqual(captured, { additions: 0, deletions: 0, isPartial: false });
});
