function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class BudgetExceededError extends Error {
  constructor() {
    super('lines_changed module budget exceeded');
    this.name = 'BudgetExceededError';
  }
}

async function withTimeout(promise, timeoutMs) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error('lines_changed request timeout')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeout);
  }
}

async function queryContributorStats(client, repo, maxRetries, timeoutMs, now, deadline, sleep, logger) {
  const remainingMs = () => deadline - now();

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (remainingMs() <= 0) {
      throw new BudgetExceededError();
    }

    try {
      const effectiveTimeoutMs = Math.max(1, Math.min(timeoutMs, remainingMs()));
      const data = await withTimeout(
        client.rest(`/repos/${repo}/stats/contributors`),
        effectiveTimeoutMs
      );
      if (Array.isArray(data)) {
        return { rows: data, pending: false };
      }
      logger.warn(`[WARN] lines_changed skipped ${repo} due to non-array contributors response`);
      return { rows: [], pending: true };
    } catch (err) {
      if (err instanceof BudgetExceededError) throw err;
      if (attempt === maxRetries) throw err;
    }

    if (remainingMs() <= 0) {
      throw new BudgetExceededError();
    }

    const backoffMs = Math.min(500 * 2 ** attempt, 5000, remainingMs());
    if (backoffMs <= 0) {
      throw new BudgetExceededError();
    }
    await sleep(backoffMs);
  }
  return { rows: [], pending: true };
}

export async function collectLinesChanged({
  client,
  repos,
  username,
  config,
  now = Date.now,
  logger = console,
  sleep = delay
}) {
  const start = now();
  const deadline = start + config.linesChangedModuleBudgetMs;
  const scoped = repos.slice(0, config.linesChangedMaxRepos);

  let additions = 0;
  let deletions = 0;
  let isPartial = false;

  for (const repo of scoped) {
    if (now() + 1 >= deadline) {
      isPartial = true;
      break;
    }

    let rows = [];
    try {
      const stats = await queryContributorStats(
        client,
        repo,
        config.linesChangedMaxRetries,
        config.linesChangedTimeoutMs,
        now,
        deadline,
        sleep,
        logger
      );
      rows = stats.rows;
      if (stats.pending) {
        isPartial = true;
      }
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        isPartial = true;
        break;
      }
      logger.warn(`[WARN] lines_changed skipped ${repo} after retries`);
      continue;
    }

    for (const authorObj of rows) {
      const author = authorObj?.author?.login;
      if (author !== username) continue;
      for (const week of authorObj?.weeks ?? []) {
        additions += week?.a ?? 0;
        deletions += week?.d ?? 0;
      }
    }
  }

  return { additions, deletions, isPartial };
}
