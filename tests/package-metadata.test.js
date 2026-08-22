import test from 'ava';
import { readFile } from 'node:fs/promises';

test('package metadata targets version 2.1.1 and Node 22', async (t) => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));

  t.is(pkg.version, '2.1.1');
  t.is(pkg.engines?.node, '>=22.0.0');
});

test('package lock metadata matches package version and Node engine', async (t) => {
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));

  t.is(lock.version, '2.1.1');
  t.is(lock.packages?.['']?.version, '2.1.1');
  t.is(lock.packages?.['']?.engines?.node, '>=22.0.0');
});
