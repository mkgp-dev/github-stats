import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('workflow runs node generator instead of python', async () => {
  const yaml = await readFile('.github/workflows/main.yml', 'utf8');

  assert.match(yaml, /actions\/setup-node/);
  assert.match(yaml, /npm ci/);
  assert.match(yaml, /npm run generate/);

  assert.doesNotMatch(yaml, /setup-python/);
  assert.doesNotMatch(yaml, /pip install/);
  assert.doesNotMatch(yaml, /generate_images\.py/);
});
