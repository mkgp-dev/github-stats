import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubClient } from '../src/github/client.js';

test('retries 202 then succeeds', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls < 3) return new Response(JSON.stringify({}), { status: 202 });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const client = createGitHubClient({
    token: 'abc',
    timeoutMs: 1000,
    maxRetries: 5,
    maxConcurrency: 2,
    fetchImpl
  });

  const data = await client.rest('/repos/a/b/traffic/views');
  assert.deepEqual(data, { ok: true });
  assert.equal(calls, 3);
});

test('fails fast on 401', async () => {
  const client = createGitHubClient({
    token: 'abc',
    timeoutMs: 1000,
    maxRetries: 5,
    maxConcurrency: 2,
    fetchImpl: async () => new Response('{}', { status: 401 })
  });

  await assert.rejects(() => client.rest('/repos/a/b/traffic/views'), /401/);
});
