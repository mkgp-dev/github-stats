import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite } from '../io/atomicWrite.js';
import { escapeHtml } from '../shared/escapeHtml.js';

function getRatio(index, total, percentage) {
  if (index === total - 1) {
    return [1, 0];
  }

  return percentage > 50 ? [0.99, 0.01] : [0.98, 0.02];
}

export async function renderLanguages({ stats, templatePath, outputDir }) {
  const template = await readFile(templatePath, 'utf8');
  const sorted = Object.entries(stats.languages).sort((a, b) => b[1].size - a[1].size);

  const progressItems = [];
  const languageItems = [];

  for (const [index, [lang, data]] of sorted.entries()) {
    const color = data.color ?? '#000000';
    const ratio = getRatio(index, sorted.length, data.prop);

    progressItems.push(
      `<span style="background-color: ${color};width: ${(ratio[0] * data.prop).toFixed(3)}%;margin-right: ${(ratio[1] * data.prop).toFixed(3)}%;" class="progress-item"></span>`
    );
    languageItems.push(
      `<li style="animation-delay: ${index * 150}ms;"><span class="lang">${escapeHtml(lang)}</span><span class="percent">${data.prop.toFixed(2)}%</span></li>`
    );
  }

  const output = template
    .replaceAll('{{ progress }}', progressItems.join(''))
    .replaceAll('{{ lang_list }}', languageItems.join(''));
  await atomicWrite(join(outputDir, 'languages.svg'), output);
}
