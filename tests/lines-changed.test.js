import test from 'node:test';
import assert from 'node:assert/strict';
import { collectLinesChanged } from '../src/stats/linesChanged.js';

test('stops at module budget and marks partial', async () => {
  let calls = 0;
  const client = {
    rest: async () => {
      calls += 1;
      return { message: 'accepted' };
    }
  };

  const result = await collectLinesChanged({
    client,
    repos: ['a/x', 'a/y', 'a/z'],
    username: 'mkgp',
    config: {
      linesChangedMaxRepos: 30,
      linesChangedTimeoutMs: 10,
      linesChangedModuleBudgetMs: 1,
      linesChangedMaxRetries: 2
    },
    now: () => 1000
  });

  assert.equal(result.isPartial, true);
  assert.equal(result.additions, 0);
  assert.equal(result.deletions, 0);
  assert.equal(calls, 0);
});
