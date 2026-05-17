import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite } from '../io/atomicWrite.js';

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString('en-US');
}

export async function renderOverview({ stats, templatePath, outputDir }) {
  const template = await readFile(templatePath, 'utf8');
  const changed = (stats.linesChanged?.additions ?? 0) + (stats.linesChanged?.deletions ?? 0);

  const output = template
    .replaceAll('{{ name }}', stats.name)
    .replaceAll('{{ stars }}', formatNumber(stats.stars))
    .replaceAll('{{ forks }}', formatNumber(stats.forks))
    .replaceAll('{{ contributions }}', formatNumber(stats.contributions))
    .replaceAll('{{ lines_changed }}', formatNumber(changed))
    .replaceAll('{{ views }}', formatNumber(stats.views))
    .replaceAll('{{ repos }}', formatNumber(stats.repoCount));

  await atomicWrite(join(outputDir, 'overview.svg'), output);
}
