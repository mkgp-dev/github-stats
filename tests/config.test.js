import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

test('loadConfig throws when ACCESS_TOKEN is missing', () => {
  assert.throws(() => loadConfig({ GITHUB_ACTOR: 'mkgp' }), /ACCESS_TOKEN/);
});

test('loadConfig throws when GITHUB_ACTOR is missing', () => {
  assert.throws(() => loadConfig({ ACCESS_TOKEN: 'abc' }), /GITHUB_ACTOR/);
});

test('loadConfig applies defaults and parses booleans/ints', () => {
  const warnings = [];
  const cfg = loadConfig(
    {
      ACCESS_TOKEN: 'abc',
      GITHUB_ACTOR: 'mkgp',
      ENABLE_LINES_CHANGED: 'true',
      COUNT_STATS_FROM_FORKS: '1'
    },
    { warn: (msg) => warnings.push(msg) }
  );

  assert.equal(cfg.repoScope, 'owned');
  assert.equal(cfg.langScope, 'owned_plus_contributed');
  assert.equal(cfg.enableLinesChanged, true);
  assert.equal(cfg.linesChangedMaxRepos, 30);
  assert.equal(cfg.requestTimeoutMs, 15000);
  assert.equal(warnings.length, 1);
});
