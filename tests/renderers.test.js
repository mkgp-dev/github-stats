import test from 'ava';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicWrite } from '../src/io/atomicWrite.js';
import { renderOverview } from '../src/render/overview.js';
import { renderLanguages } from '../src/render/languages.js';

test('renderers write both files and resolve placeholders', async (t) => {
  const outDir = await mkdtemp(join(tmpdir(), 'gh-stats-'));
  const stats = {
    name: 'A&B <MK>',
    stars: 10,
    forks: 3,
    contributions: 7,
    views: 20,
    repoCount: 2,
    linesChanged: { additions: 5, deletions: 2, isPartial: false },
    languages: {
      'A&B': { size: 100, occurrences: 1, color: null, prop: 100 }
    }
  };

  await renderOverview({ stats, templatePath: 'templates/overview.svg', outputDir: outDir });
  await renderLanguages({ stats, templatePath: 'templates/languages.svg', outputDir: outDir });

  const overview = await readFile(join(outDir, 'overview.svg'), 'utf8');
  const languages = await readFile(join(outDir, 'languages.svg'), 'utf8');

  t.is(overview.includes('{{'), false);
  t.is(languages.includes('{{'), false);
  t.regex(overview, /A&amp;B &lt;MK&gt;/);
  t.regex(languages, /A&amp;B/);
  t.regex(languages, /class="octicon" style="fill:#000000;"/);
  t.regex(languages, /<path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8z"><\/path>/);
});

test('atomicWrite supports concurrent writes to same target', async (t) => {
  const outDir = await mkdtemp(join(tmpdir(), 'gh-stats-'));
  const filePath = join(outDir, 'overview.svg');

  await Promise.all([
    atomicWrite(filePath, 'one'),
    atomicWrite(filePath, 'two'),
    atomicWrite(filePath, 'three')
  ]);

  const finalContent = await readFile(filePath, 'utf8');
  t.truthy(['one', 'two', 'three'].includes(finalContent));
});

test('overview renders lines changed as 0 when disabled', async (t) => {
  const outDir = await mkdtemp(join(tmpdir(), 'gh-stats-'));
  const stats = {
    name: 'MK',
    stars: 10,
    forks: 3,
    contributions: 7,
    views: 20,
    repoCount: 2,
    linesChanged: { additions: 0, deletions: 0, isPartial: false },
    activityMetricIcon: '<svg class="octicon" xmlns="http://www.w3.org/2000/svg"></svg>',
    activityMetricLabel: 'Merged pull requests',
    activityMetricValue: 12,
    languages: {
      JavaScript: { size: 100, occurrences: 1, color: '#f1e05a', prop: 100 }
    }
  };

  await renderOverview({ stats, templatePath: 'templates/overview.svg', outputDir: outDir });
  const overview = await readFile(join(outDir, 'overview.svg'), 'utf8');

  t.regex(overview, /<svg class="octicon" xmlns="http:\/\/www\.w3\.org\/2000\/svg"><\/svg>Merged pull requests<\/td><td>12<\/td>/);
});
