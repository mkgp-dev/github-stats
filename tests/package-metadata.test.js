import test from 'ava';
import { readFile } from 'node:fs/promises';

const NODE_ENGINE = '^22.20 || ^24.12 || >=26';

test('package metadata targets version 2.1.3 and a supported Node range', async (t) => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));

  t.is(pkg.version, '2.1.3');
  t.is(pkg.engines?.node, NODE_ENGINE);
});

test('package lock metadata matches package version and Node engine', async (t) => {
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));

  t.is(lock.version, '2.1.3');
  t.is(lock.packages?.['']?.version, '2.1.3');
  t.is(lock.packages?.['']?.engines?.node, NODE_ENGINE);
});

test('declared Node engine is not looser than the test runner requires', async (t) => {
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
  const ava = lock.packages?.['node_modules/ava'];

  t.truthy(ava, 'ava must be present in the lockfile');
  t.is(
    lock.packages?.['']?.engines?.node,
    ava.engines?.node,
    'engines.node must match ava so npm ci cannot install a runtime ava rejects'
  );
});
