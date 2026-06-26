import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildResultPayload, writeResultJson } from '../src/render/resultJson.js';

function statsFixture() {
  return {
    name: 'MK',
    login: 'mkgp',
    repoCount: 2,
    stars: 11,
    forks: 5,
    contributions: 9,
    views: 14,
    languages: {
      JavaScript: { size: 100, occurrences: 1, color: '#f1e05a', prop: 80 },
      Go: { size: 25, occurrences: 1, color: '#000000', prop: 20 }
    },
    linesChanged: { additions: 3, deletions: 4, isPartial: true },
    activityMetricLabel: 'Lines of code changed',
    activityMetricValue: 7,
    activityMetricIcon: '<svg class="octicon"></svg>',
    repoNamesForLines: ['mkgp/owned', 'other/contrib'],
    sources: {
      ownedRepos: [
        {
          nameWithOwner: 'mkgp/owned',
          stars: 10,
          forks: 4,
          views: 14,
          languages: [{ name: 'JavaScript', size: 100, color: '#f1e05a' }]
        }
      ],
      contributedRepos: [
        {
          nameWithOwner: 'other/contrib',
          stars: 1,
          forks: 1,
          languages: [{ name: 'Go', size: 25, color: '#000000' }]
        }
      ],
      metricRepos: [],
      languageRepos: []
    }
  };
}

function configFixture() {
  return {
    accessToken: 'secret-token',
    githubActor: 'mkgp',
    repoScope: 'owned_plus_contributed',
    langScope: 'owned_plus_contributed',
    enableLinesChanged: true,
    linesChangedMaxRepos: 30,
    linesChangedTimeoutMs: 20000,
    linesChangedModuleBudgetMs: 120000,
    linesChangedMaxRetries: 5,
    excludedRepos: new Set(['mkgp/private']),
    excludedLangs: new Set(['HTML'])
  };
}

test('buildResultPayload serializes safe summary, config, and sources', () => {
  const payload = buildResultPayload({
    stats: statsFixture(),
    config: configFixture(),
    generatedAt: '2026-06-26T00:00:00.000Z'
  });

  assert.equal(payload.version, '2.1.0');
  assert.equal(payload.generatedAt, '2026-06-26T00:00:00.000Z');
  assert.deepEqual(payload.config, {
    repoScope: 'owned_plus_contributed',
    langScope: 'owned_plus_contributed',
    enableLinesChanged: true,
    linesChangedMaxRepos: 30,
    linesChangedTimeoutMs: 20000,
    linesChangedModuleBudgetMs: 120000,
    linesChangedMaxRetries: 5,
    excludedRepos: ['mkgp/private'],
    excludedLangs: ['HTML']
  });
  assert.deepEqual(payload.summary.linesChanged, { additions: 3, deletions: 4, isPartial: true });
  assert.equal(payload.summary.activityMetricLabel, 'Lines of code changed');
  assert.equal(payload.summary.activityMetricValue, 7);
  assert.equal('activityMetricIcon' in payload.summary, false);
  assert.equal('accessToken' in payload.config, false);
  assert.deepEqual(payload.sources.linesChangedRepos, ['mkgp/owned', 'other/contrib']);
});

test('buildResultPayload leaves linesChangedRepos empty when lines changed is disabled', () => {
  const payload = buildResultPayload({
    stats: statsFixture(),
    config: { ...configFixture(), enableLinesChanged: false },
    generatedAt: '2026-06-26T00:00:00.000Z'
  });

  assert.deepEqual(payload.sources.linesChangedRepos, []);
});

test('writeResultJson writes formatted JSON with trailing newline', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'github-stats-result-'));

  await writeResultJson({
    stats: statsFixture(),
    config: configFixture(),
    outputDir: outDir,
    now: () => new Date('2026-06-26T00:00:00.000Z')
  });

  const content = await readFile(join(outDir, 'result.json'), 'utf8');
  const parsed = JSON.parse(content);

  assert.equal(content.endsWith('\n'), true);
  assert.match(content, /\n  "version": "2\.1\.0"/);
  assert.equal(parsed.generatedAt, '2026-06-26T00:00:00.000Z');
  assert.equal(content.includes('secret-token'), false);
  assert.equal(content.includes('<svg'), false);
});
