import test from 'node:test';
import assert from 'node:assert/strict';
import { collectLinesChanged } from '../src/stats/linesChanged.js';

test('sums additions/deletions for matching username', async () => {
  const client = {
    rest: async () => ([
      {
        author: { login: 'mkgp' },
        weeks: [{ a: 5, d: 2 }, { a: 3, d: 1 }]
      },
      {
        author: { login: 'other' },
        weeks: [{ a: 100, d: 100 }]
      }
    ])
  };

  const result = await collectLinesChanged({
    client,
    repos: ['a/x'],
    username: 'mkgp',
    config: {
      linesChangedMaxRepos: 30,
      linesChangedTimeoutMs: 100,
      linesChangedModuleBudgetMs: 10_000,
      linesChangedMaxRetries: 2
    }
  });

  assert.equal(result.isPartial, false);
  assert.equal(result.additions, 8);
  assert.equal(result.deletions, 3);
});

test('retries once then succeeds', async () => {
  let calls = 0;
  const client = {
    rest: async () => {
      calls += 1;
      if (calls === 1) throw new Error('transient');
      return [{ author: { login: 'mkgp' }, weeks: [{ a: 4, d: 2 }] }];
    }
  };

  const result = await collectLinesChanged({
    client,
    repos: ['a/x'],
    username: 'mkgp',
    config: {
      linesChangedMaxRepos: 30,
      linesChangedTimeoutMs: 100,
      linesChangedModuleBudgetMs: 10_000,
      linesChangedMaxRetries: 2
    },
    sleep: async () => {}
  });

  assert.equal(result.isPartial, false);
  assert.equal(result.additions, 4);
  assert.equal(result.deletions, 2);
  assert.equal(calls, 2);
});

test('skip path emits warning after retries', async () => {
  const warnings = [];
  const logger = { warn: (msg) => warnings.push(msg) };
  const client = {
    rest: async () => {
      throw new Error('down');
    }
  };

  const result = await collectLinesChanged({
    client,
    repos: ['a/x'],
    username: 'mkgp',
    config: {
      linesChangedMaxRepos: 30,
      linesChangedTimeoutMs: 100,
      linesChangedModuleBudgetMs: 10_000,
      linesChangedMaxRetries: 1
    },
    logger,
    sleep: async () => {}
  });

  assert.equal(result.isPartial, false);
  assert.equal(result.additions, 0);
  assert.equal(result.deletions, 0);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /lines_changed skipped a\/x after retries/);
});

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
