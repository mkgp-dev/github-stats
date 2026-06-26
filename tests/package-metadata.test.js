import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('package metadata targets version 2.1.0 and Node 22', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));

  assert.equal(pkg.version, '2.1.0');
  assert.equal(pkg.engines?.node, '>=22.0.0');
});

test('package lock metadata matches package version and Node engine', async () => {
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));

  assert.equal(lock.version, '2.1.0');
  assert.equal(lock.packages?.['']?.version, '2.1.0');
  assert.equal(lock.packages?.['']?.engines?.node, '>=22.0.0');
});
