import { loadConfig } from './config.js';
import { createGitHubClient } from './github/client.js';
import { collectCoreStats } from './stats/collector.js';
import { collectLinesChanged } from './stats/linesChanged.js';
import { renderOverview } from './render/overview.js';
import { renderLanguages } from './render/languages.js';
import { writeResultJson } from './render/resultJson.js';

const LOGIN_QUERY = 'query { viewer { login } }';
const ACTIVITY_METRIC_LINES_CHANGED_LABEL = 'Lines of code changed';
const ACTIVITY_METRIC_MERGED_PRS_LABEL = 'Merged pull requests';
const ACTIVITY_METRIC_LINES_CHANGED_ICON =
  '<svg class="octicon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill-rule="evenodd" d="M8.75 1.75a.75.75 0 00-1.5 0V5H4a.75.75 0 000 1.5h3.25v3.25a.75.75 0 001.5 0V6.5H12A.75.75 0 0012 5H8.75V1.75zM4 13a.75.75 0 000 1.5h8a.75.75 0 100-1.5H4z"></path></svg>';
const ACTIVITY_METRIC_MERGED_PRS_ICON =
  '<svg class="octicon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" version="1.1" width="16" height="16" role="img"><path fill-rule="evenodd" d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"></path></svg>';

function mergedPullRequestCountQuery(login) {
  return `query { search(type: ISSUE, query: "author:${login} is:pr is:merged") { issueCount } }`;
}

async function getMergedPullRequestCount(client, login) {
  try {
    const response = await client.graphql(mergedPullRequestCountQuery(login));
    return response?.data?.search?.issueCount ?? null;
  } catch {
    return null;
  }
}

function buildClient(config) {
  return createGitHubClient({
    token: config.accessToken,
    timeoutMs: config.requestTimeoutMs,
    maxRetries: config.maxRetries,
    maxConcurrency: config.maxConcurrency
  });
}

export async function run(deps = {}) {
  const {
    loadConfig: useLoadConfig = loadConfig,
    createClient: useCreateClient = buildClient,
    collectCoreStats: useCollectCoreStats = collectCoreStats,
    collectLinesChanged: useCollectLinesChanged = collectLinesChanged,
    renderOverview: useRenderOverview = renderOverview,
    renderLanguages: useRenderLanguages = renderLanguages,
    writeResultJson: useWriteResultJson = writeResultJson
  } = deps;

  const config = useLoadConfig();
  const client = useCreateClient(config);

  const loginData = await client.graphql(LOGIN_QUERY);
  const tokenLogin = loginData?.data?.viewer?.login;
  const normalizedTokenLogin = String(tokenLogin ?? '').toLowerCase();
  const normalizedActor = String(config.githubActor ?? '').toLowerCase();
  if (normalizedTokenLogin !== normalizedActor) {
    throw new Error(`Token login mismatch: expected ${config.githubActor}, got ${tokenLogin}`);
  }

  const stats = await useCollectCoreStats(client, config);

  if (config.enableLinesChanged) {
    const repos =
      config.repoScope === 'owned_plus_contributed'
        ? (stats.repoNamesForLines ?? [])
        : (stats.ownedRepoNames ?? []);

    stats.linesChanged = await useCollectLinesChanged({
      client,
      repos,
      username: config.githubActor,
      config
    });
    stats.activityMetricLabel = ACTIVITY_METRIC_LINES_CHANGED_LABEL;
    stats.activityMetricValue =
      (stats.linesChanged?.additions ?? 0) + (stats.linesChanged?.deletions ?? 0);
    stats.activityMetricIcon = ACTIVITY_METRIC_LINES_CHANGED_ICON;
  } else {
    stats.linesChanged = { additions: 0, deletions: 0, isPartial: false };
    stats.activityMetricLabel = ACTIVITY_METRIC_MERGED_PRS_LABEL;
    stats.activityMetricValue = await getMergedPullRequestCount(client, config.githubActor);
    stats.activityMetricIcon = ACTIVITY_METRIC_MERGED_PRS_ICON;
  }

  await Promise.all([
    useRenderOverview({
      stats,
      templatePath: 'templates/overview.svg',
      outputDir: 'generated'
    }),
    useRenderLanguages({
      stats,
      templatePath: 'templates/languages.svg',
      outputDir: 'generated'
    })
  ]);

  await useWriteResultJson({
    stats,
    config,
    outputPath: 'result.json'
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error(err?.message ?? err);
    process.exit(1);
  });
}
