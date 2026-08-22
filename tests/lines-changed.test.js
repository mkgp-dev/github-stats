import test from 'ava';
import { collectLinesChanged } from '../src/stats/linesChanged.js';

test('sums additions/deletions for matching username', async (t) => {
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

  t.is(result.isPartial, false);
  t.is(result.additions, 8);
  t.is(result.deletions, 3);
});

test('retries once then succeeds', async (t) => {
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

  t.is(result.isPartial, false);
  t.is(result.additions, 4);
  t.is(result.deletions, 2);
  t.is(calls, 2);
});

test('skip path emits warning after retries', async (t) => {
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

  t.is(result.isPartial, true);
  t.is(result.additions, 0);
  t.is(result.deletions, 0);
  t.is(warnings.length, 1);
  t.regex(warnings[0], /lines_changed skipped a\/x after retries/);
});

test('stops at module budget and marks partial', async (t) => {
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

  t.is(result.isPartial, true);
  t.is(result.additions, 0);
  t.is(result.deletions, 0);
  t.is(calls, 0);
});

test('marks partial when contributor stats remains pending/non-array', async (t) => {
  let calls = 0;
  const client = {
    rest: async () => {
      calls += 1;
      return { message: 'accepted' };
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

  t.is(result.isPartial, true);
  t.is(result.additions, 0);
  t.is(result.deletions, 0);
  t.is(calls, 1);
});
