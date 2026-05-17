import { AsyncSemaphore } from './semaphore.js';

const RETRYABLE = new Set([202, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonSafe(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function computeBackoff(attempt) {
  const base = 500;
  const cap = 30000;
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(base * 2 ** attempt + jitter, cap);
}

function parseRetryAfterMs(rawValue, nowMs) {
  if (typeof rawValue !== 'string') return null;

  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const seconds = Number.parseInt(trimmed, 10);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const targetTime = Date.parse(trimmed);
  if (!Number.isNaN(targetTime)) {
    return Math.max(0, targetTime - nowMs);
  }

  return null;
}

function isTransientError(err) {
  if (!err || typeof err !== 'object') return false;
  if (err.name === 'AbortError') return true;
  if (err instanceof TypeError) return true;
  return false;
}

export function createGitHubClient({
  token,
  timeoutMs,
  maxRetries,
  maxConcurrency,
  fetchImpl = fetch,
  sleepImpl = sleep,
  backoffImpl = computeBackoff,
  nowImpl = () => Date.now()
}) {
  const sem = new AsyncSemaphore(maxConcurrency);

  async function request(url, init, attempt = 0) {
    let result;
    try {
      result = await sem.withPermit(async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const resp = await fetchImpl(url, { ...init, signal: controller.signal });
          const bodyText = await resp.text();
          const body = parseJsonSafe(bodyText);
          return { resp, body };
        } finally {
          clearTimeout(timeout);
        }
      });
    } catch (err) {
      if (isTransientError(err) && attempt < maxRetries) {
        await sleepImpl(backoffImpl(attempt));
        return request(url, init, attempt + 1);
      }
      throw err;
    }

    const { resp, body } = result;

    if (resp.status === 401) {
      throw new Error('GitHub API returned 401 unauthorized');
    }

    const secondaryLimit =
      resp.status === 403 &&
      typeof body?.message === 'string' &&
      body.message.toLowerCase().includes('secondary rate limit');

    const retryable = RETRYABLE.has(resp.status) || secondaryLimit;
    if (retryable && attempt < maxRetries) {
      const retryAfterMs = parseRetryAfterMs(resp.headers.get('retry-after'), nowImpl());
      const delay = retryAfterMs ?? backoffImpl(attempt);
      await sleepImpl(Math.max(delay, secondaryLimit ? 60000 : 0));
      return request(url, init, attempt + 1);
    }

    if (!resp.ok) {
      throw new Error(`GitHub API failed with status ${resp.status}`);
    }

    return body;
  }

  return {
    graphql: (query) =>
      request('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      }),
    rest: (path) =>
      request(`https://api.github.com/${path.replace(/^\//, '')}`, {
        method: 'GET',
        headers: {
          Authorization: `token ${token}`
        }
      })
  };
}

export const __testables = {
  parseRetryAfterMs,
  isTransientError
};
