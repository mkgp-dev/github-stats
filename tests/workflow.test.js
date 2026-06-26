import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('workflow runs node generator instead of python', async () => {
  const yaml = await readFile('.github/workflows/main.yml', 'utf8');

  assert.match(yaml, /actions\/setup-node/);
  assert.match(yaml, /node-version:\s*["']22["']/);
  assert.doesNotMatch(yaml, /node-version:\s*["']20["']/);
  assert.match(yaml, /npm ci/);
  assert.match(yaml, /npm run generate/);

  assert.doesNotMatch(yaml, /setup-python/);
  assert.doesNotMatch(yaml, /pip install/);
  assert.doesNotMatch(yaml, /generate_images\.py/);

  assert.match(yaml, /GITHUB_ACTOR:\s*\$\{\{\s*secrets\.GH_STATS_ACTOR\s*\}\}/);
  assert.doesNotMatch(yaml, /GITHUB_ACTOR:\s*\$\{\{\s*github\.actor\s*\}\}/);
});
