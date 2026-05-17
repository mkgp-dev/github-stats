import { loadConfig } from './config.js';
import { createGitHubClient } from './github/client.js';
import { collectCoreStats } from './stats/collector.js';
import { collectLinesChanged } from './stats/linesChanged.js';
import { renderOverview } from './render/overview.js';
import { renderLanguages } from './render/languages.js';

const LOGIN_QUERY = 'query { viewer { login } }';

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
    renderLanguages: useRenderLanguages = renderLanguages
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
  } else {
    stats.linesChanged = { additions: 0, deletions: 0, isPartial: false };
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
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error(err?.message ?? err);
    process.exit(1);
  });
}
