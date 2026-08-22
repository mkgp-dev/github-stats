import test from 'ava';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildResultPayload, writeResultJson } from '../src/render/resultJson.js';
import packageJson from '../package.json' with { type: 'json' };

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
    repoNamesForLines: ['mkgp/owned', 'other/contrib']
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
    metricOwners: new Set(['mkgp-dev', 'ternilabs']),
    excludedRepos: new Set(['mkgp/private']),
    excludedLangs: new Set(['HTML'])
  };
}

test('buildResultPayload serializes safe summary and config, omits sources', (t) => {
  const payload = buildResultPayload({
    stats: statsFixture(),
    config: configFixture(),
    generatedAt: '2026-06-26T00:00:00.000Z'
  });

  t.is(payload.version, packageJson.version);
  t.is(payload.generatedAt, '2026-06-26T00:00:00.000Z');
  t.deepEqual(payload.config, {
    repoScope: 'owned_plus_contributed',
    langScope: 'owned_plus_contributed',
    enableLinesChanged: true,
    linesChangedMaxRepos: 30,
    linesChangedTimeoutMs: 20000,
    linesChangedModuleBudgetMs: 120000,
    linesChangedMaxRetries: 5,
    metricOwners: ['mkgp-dev', 'ternilabs'],
    excludedRepos: ['mkgp/private'],
    excludedLangs: ['HTML']
  });
  t.deepEqual(payload.summary.linesChanged, { additions: 3, deletions: 4, isPartial: true });
  t.is(payload.summary.activityMetricLabel, 'Lines of code changed');
  t.is(payload.summary.activityMetricValue, 7);
  t.is('activityMetricIcon' in payload.summary, false);
  t.is('accessToken' in payload.config, false);
  t.is('sources' in payload, false);
});

test('writeResultJson writes formatted JSON to root result path with trailing newline', async (t) => {
  const outDir = await mkdtemp(join(tmpdir(), 'github-stats-result-'));
  const outputPath = join(outDir, 'result.json');

  await writeResultJson({
    stats: statsFixture(),
    config: configFixture(),
    outputPath,
    now: () => new Date('2026-06-26T00:00:00.000Z')
  });

  const content = await readFile(outputPath, 'utf8');
  const parsed = JSON.parse(content);

  await t.throwsAsync(() => stat(join(outDir, 'generated', 'result.json')), { message: /ENOENT/ });
  t.is(content.endsWith('\n'), true);
  t.is(parsed.version, packageJson.version);
  t.is(parsed.generatedAt, '2026-06-26T00:00:00.000Z');
  t.is(content.includes('secret-token'), false);
  t.is(content.includes('<svg'), false);
  t.is(content.includes('mkgp/owned'), false);
  t.is(content.includes('other/contrib'), false);
});
