function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function queryContributorStats(client, repo, maxRetries, timeoutMs) {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const data = await withTimeout(
        client.rest(`/repos/${repo}/stats/contributors`),
        timeoutMs
      );
      if (Array.isArray(data)) return data;
    } catch (err) {
      if (attempt === maxRetries) throw err;
    }
    await delay(Math.min(500 * 2 ** attempt, 5000));
  }
  return [];
}

export async function collectLinesChanged({ client, repos, username, config, now = Date.now, logger = console }) {
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
      rows = await queryContributorStats(
        client,
        repo,
        config.linesChangedMaxRetries,
        config.linesChangedTimeoutMs
      );
    } catch {
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
