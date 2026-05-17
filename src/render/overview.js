import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite } from '../io/atomicWrite.js';
import { escapeHtml } from '../shared/escapeHtml.js';

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString('en-US');
}

function formatMetricValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatNumber(value);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return escapeHtml(value);
  }
  return 'N/A';
}

export async function renderOverview({ stats, templatePath, outputDir }) {
  const template = await readFile(templatePath, 'utf8');
  const changed = (stats.linesChanged?.additions ?? 0) + (stats.linesChanged?.deletions ?? 0);
  const metricLabel = stats.activityMetricLabel ?? 'Lines of code changed';
  const metricValue = stats.activityMetricValue ?? changed;
  const metricIcon = stats.activityMetricIcon ?? '';

  const output = template
    .replaceAll('{{ name }}', escapeHtml(stats.name))
    .replaceAll('{{ stars }}', formatNumber(stats.stars))
    .replaceAll('{{ forks }}', formatNumber(stats.forks))
    .replaceAll('{{ contributions }}', formatNumber(stats.contributions))
    .replaceAll('{{ activity_metric_icon }}', metricIcon)
    .replaceAll('{{ activity_metric_label }}', escapeHtml(metricLabel))
    .replaceAll('{{ activity_metric_value }}', formatMetricValue(metricValue))
    .replaceAll('{{ views }}', formatNumber(stats.views))
    .replaceAll('{{ repos }}', formatNumber(stats.repoCount));

  await atomicWrite(join(outputDir, 'overview.svg'), output);
}
