import { join } from 'node:path';
import { atomicWrite } from '../io/atomicWrite.js';

const RESULT_VERSION = '2.1.0';

function setToArray(value) {
  return [...(value ?? [])];
}

function serializeConfig(config) {
  return {
    repoScope: config.repoScope,
    langScope: config.langScope,
    enableLinesChanged: config.enableLinesChanged,
    linesChangedMaxRepos: config.linesChangedMaxRepos,
    linesChangedTimeoutMs: config.linesChangedTimeoutMs,
    linesChangedModuleBudgetMs: config.linesChangedModuleBudgetMs,
    linesChangedMaxRetries: config.linesChangedMaxRetries,
    excludedRepos: setToArray(config.excludedRepos),
    excludedLangs: setToArray(config.excludedLangs)
  };
}

function serializeSummary(stats) {
  return {
    name: stats.name,
    login: stats.login,
    repoCount: stats.repoCount,
    stars: stats.stars,
    forks: stats.forks,
    contributions: stats.contributions,
    views: stats.views,
    languages: stats.languages,
    linesChanged: stats.linesChanged,
    activityMetricLabel: stats.activityMetricLabel,
    activityMetricValue: stats.activityMetricValue
  };
}

function serializeSources(stats, config) {
  const sources = stats.sources ?? {
    ownedRepos: [],
    contributedRepos: [],
    metricRepos: [],
    languageRepos: []
  };

  return {
    ownedRepos: sources.ownedRepos ?? [],
    contributedRepos: sources.contributedRepos ?? [],
    metricRepos: sources.metricRepos ?? [],
    languageRepos: sources.languageRepos ?? [],
    linesChangedRepos: config.enableLinesChanged
      ? (stats.repoNamesForLines ?? []).slice(0, config.linesChangedMaxRepos)
      : []
  };
}

export function buildResultPayload({
  stats,
  config,
  generatedAt = new Date().toISOString(),
  version = RESULT_VERSION
}) {
  return {
    version,
    generatedAt,
    config: serializeConfig(config),
    summary: serializeSummary(stats),
    sources: serializeSources(stats, config)
  };
}

export async function writeResultJson({
  stats,
  config,
  outputDir = 'generated',
  now = () => new Date()
}) {
  const payload = buildResultPayload({
    stats,
    config,
    generatedAt: now().toISOString()
  });
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  await atomicWrite(join(outputDir, 'result.json'), content);
}
