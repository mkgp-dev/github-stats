import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderOverview } from '../src/render/overview.js';
import { renderLanguages } from '../src/render/languages.js';

test('renderers write both files and resolve placeholders', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'gh-stats-'));
  const stats = {
    name: 'MK',
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

  assert.equal(overview.includes('{{'), false);
  assert.equal(languages.includes('{{'), false);
  assert.match(languages, /A&amp;B/);
});
