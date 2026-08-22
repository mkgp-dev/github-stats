import test from 'ava';
import { createGitHubClient } from '../src/github/client.js';
import { AsyncSemaphore } from '../src/github/semaphore.js';

test('retries 202 then succeeds', async (t) => {
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
  t.deepEqual(data, { ok: true });
  t.is(calls, 3);
});

test('fails fast on 401', async (t) => {
  const client = createGitHubClient({
    token: 'abc',
    timeoutMs: 1000,
    maxRetries: 5,
    maxConcurrency: 2,
    fetchImpl: async () => new Response('{}', { status: 401 })
  });

  await t.throwsAsync(() => client.rest('/repos/a/b/traffic/views'), { message: /401/ });
});

test('retries transient fetch error then succeeds', async (t) => {
  let calls = 0;
  const sleepCalls = [];
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      throw new TypeError('network down');
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const client = createGitHubClient({
    token: 'abc',
    timeoutMs: 1000,
    maxRetries: 3,
    maxConcurrency: 2,
    fetchImpl,
    backoffImpl: () => 42,
    sleepImpl: async (ms) => {
      sleepCalls.push(ms);
    }
  });

  const data = await client.rest('/repos/a/b/traffic/views');
  t.deepEqual(data, { ok: true });
  t.is(calls, 2);
  t.deepEqual(sleepCalls, [42]);
});

test('AsyncSemaphore throws for invalid limit', (t) => {
  t.throws(() => new AsyncSemaphore(0), { message: /positive integer/ });
  t.throws(() => new AsyncSemaphore(-1), { message: /positive integer/ });
  t.throws(() => new AsyncSemaphore(1.5), { message: /positive integer/ });
});

test('enforces maxConcurrency for in-flight requests', async (t) => {
  let inFlight = 0;
  let maxInFlight = 0;
  let releaseGate;
  const gate = new Promise((resolve) => {
    releaseGate = resolve;
  });

  const fetchImpl = async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await gate;
    inFlight -= 1;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const client = createGitHubClient({
    token: 'abc',
    timeoutMs: 5000,
    maxRetries: 0,
    maxConcurrency: 2,
    fetchImpl
  });

  const requests = [
    client.rest('/repos/a/1/traffic/views'),
    client.rest('/repos/a/2/traffic/views'),
    client.rest('/repos/a/3/traffic/views'),
    client.rest('/repos/a/4/traffic/views')
  ];

  // Wait briefly for the first wave to acquire permits, without relying on one microtask tick.
  for (let i = 0; i < 20 && maxInFlight < 2; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  t.is(maxInFlight <= 2, true);
  releaseGate();

  const results = await Promise.all(requests);
  t.is(results.length, 4);
  t.is(maxInFlight, 2);
});

test('uses retry-after HTTP-date delay path', async (t) => {
  let calls = 0;
  const sleepCalls = [];
  const now = Date.parse('2026-05-17T00:00:00.000Z');
  const retryAt = new Date(now + 5000).toUTCString();

  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response('{}', {
        status: 429,
        headers: {
          'retry-after': retryAt
        }
      });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const client = createGitHubClient({
    token: 'abc',
    timeoutMs: 1000,
    maxRetries: 3,
    maxConcurrency: 2,
    fetchImpl,
    nowImpl: () => now,
    backoffImpl: () => {
      throw new Error('backoff should not be called when retry-after date is present');
    },
    sleepImpl: async (ms) => {
      sleepCalls.push(ms);
    }
  });

  const data = await client.rest('/repos/a/b/traffic/views');
  t.deepEqual(data, { ok: true });
  t.is(calls, 2);
  t.is(sleepCalls.length, 1);
  t.is(Number.isFinite(sleepCalls[0]), true);
  t.is(sleepCalls[0] >= 0, true);
});

test('ignores malformed retry-after numeric and falls back to backoff', async (t) => {
  let calls = 0;
  const sleepCalls = [];

  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response('{}', {
        status: 429,
        headers: {
          'retry-after': '1.5'
        }
      });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const client = createGitHubClient({
    token: 'abc',
    timeoutMs: 1000,
    maxRetries: 3,
    maxConcurrency: 2,
    fetchImpl,
    backoffImpl: () => 77,
    sleepImpl: async (ms) => {
      sleepCalls.push(ms);
    }
  });

  const data = await client.rest('/repos/a/b/traffic/views');
  t.deepEqual(data, { ok: true });
  t.is(calls, 2);
  t.deepEqual(sleepCalls, [77]);
});

test('graphql throws when response body contains errors', async (t) => {
  const client = createGitHubClient({
    token: 'abc',
    timeoutMs: 1000,
    maxRetries: 0,
    maxConcurrency: 2,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          data: null,
          errors: [{ message: 'Something broke' }]
        }),
        { status: 200 }
      )
  });

  const err = await t.throwsAsync(() => client.graphql('query { viewer { login } }'));
  t.is(err.name, 'GitHubGraphQLError');
  t.is(err.status, 200);
  t.regex(err.message, /Something broke/);
});
