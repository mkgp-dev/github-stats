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
    renderLanguages: async () => calls.push('languages'),
    writeResultJson: async () => {}
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
    },
    writeResultJson: async () => {}
  };

  await assert.rejects(() => run(deps), /Token login mismatch/);
});

test('run rejects before collection when actor/token login mismatches', async () => {
  let collectCalled = false;
  const deps = {
    loadConfig: () => baseConfig({ githubActor: 'mkgp' }),
    createClient: () => ({
      graphql: async () => ({ data: { viewer: { login: 'other-user' } } })
    }),
    collectCoreStats: async () => {
      collectCalled = true;
      return baseStats();
    },
    writeResultJson: async () => {}
  };

  await assert.rejects(() => run(deps), /Token login mismatch/);
  assert.equal(collectCalled, false);
});

test('run treats token login match as case-insensitive', async () => {
  let collected = false;
  const deps = {
    loadConfig: () => baseConfig({ githubActor: 'MKGP' }),
    createClient: () => ({
      graphql: async () => ({ data: { viewer: { login: 'mkgp' } } })
    }),
    collectCoreStats: async () => {
      collected = true;
      return baseStats();
    },
    renderOverview: async () => {},
    renderLanguages: async () => {},
    writeResultJson: async () => {}
  };

  await run(deps);
  assert.equal(collected, true);
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
      calls.push([
        'overview',
        stats.linesChanged,
        stats.activityMetricLabel,
        stats.activityMetricValue
      ]);
    },
    renderLanguages: async () => {
      calls.push(['languages']);
    },
    writeResultJson: async () => {}
  };

  await run(deps);

  assert.deepEqual(calls[0], ['lines', ['mkgp/owned', 'other/contrib'], 'mkgp']);
  assert.deepEqual(calls[1], [
    'overview',
    { additions: 5, deletions: 2, isPartial: false },
    'Lines of code changed',
    7
  ]);
});

test('run sets zero lines changed when disabled', async () => {
  let capturedLinesChanged;
  let capturedMetricLabel;
  let capturedMetricValue;
  let capturedMetricIcon;
  const deps = {
    loadConfig: () => baseConfig({ enableLinesChanged: false }),
    createClient: () => ({
      graphql: async (query) => {
        if (query.includes('viewer { login }')) {
          return { data: { viewer: { login: 'mkgp' } } };
        }
        if (query.includes('is:pr is:merged')) {
          return { data: { search: { issueCount: 42 } } };
        }
        return {};
      }
    }),
    collectCoreStats: async () => baseStats({ linesChanged: null }),
    renderOverview: async ({ stats }) => {
      capturedLinesChanged = stats.linesChanged;
      capturedMetricLabel = stats.activityMetricLabel;
      capturedMetricValue = stats.activityMetricValue;
      capturedMetricIcon = stats.activityMetricIcon;
    },
    renderLanguages: async () => {},
    writeResultJson: async () => {}
  };

  await run(deps);
  assert.deepEqual(capturedLinesChanged, { additions: 0, deletions: 0, isPartial: false });
  assert.equal(capturedMetricLabel, 'Merged pull requests');
  assert.equal(capturedMetricValue, 42);
  assert.match(capturedMetricIcon, /class="octicon"/);
});

test('run writes result json after resolving final stats', async () => {
  let captured;
  const deps = {
    loadConfig: () => baseConfig({ enableLinesChanged: true, repoScope: 'owned_plus_contributed' }),
    createClient: () => ({
      graphql: async () => ({ data: { viewer: { login: 'mkgp' } } })
    }),
    collectCoreStats: async () =>
      baseStats({
        sources: {
          ownedRepos: [],
          contributedRepos: [],
          metricRepos: [],
          languageRepos: []
        }
      }),
    collectLinesChanged: async () => ({ additions: 5, deletions: 2, isPartial: false }),
    renderOverview: async () => {},
    renderLanguages: async () => {},
    writeResultJson: async (args) => {
      captured = args;
    }
  };

  await run(deps);

  assert.equal(captured.config.enableLinesChanged, true);
  assert.equal(captured.outputPath, 'result.json');
  assert.deepEqual(captured.stats.linesChanged, { additions: 5, deletions: 2, isPartial: false });
  assert.equal(captured.stats.activityMetricLabel, 'Lines of code changed');
  assert.equal(captured.stats.activityMetricValue, 7);
});

test('run keeps svg outputs under generated while result json writes at root', async () => {
  const calls = [];
  const deps = {
    loadConfig: () => baseConfig({ enableLinesChanged: false }),
    createClient: () => ({
      graphql: async (query) => {
        if (query.includes('viewer { login }')) {
          return { data: { viewer: { login: 'mkgp' } } };
        }
        if (query.includes('is:pr is:merged')) {
          return { data: { search: { issueCount: 1 } } };
        }
        return {};
      }
    }),
    collectCoreStats: async () => baseStats(),
    renderOverview: async ({ outputDir }) => calls.push(['overview', outputDir]),
    renderLanguages: async ({ outputDir }) => calls.push(['languages', outputDir]),
    writeResultJson: async ({ outputPath }) => calls.push(['result', outputPath])
  };

  await run(deps);

  assert.deepEqual(calls.sort(), [
    ['languages', 'generated'],
    ['overview', 'generated'],
    ['result', 'result.json']
  ]);
});
