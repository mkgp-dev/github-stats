import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite } from '../io/atomicWrite.js';
import { escapeHtml } from '../shared/escapeHtml.js';

export async function renderLanguages({ stats, templatePath, outputDir }) {
  const template = await readFile(templatePath, 'utf8');
  const sorted = Object.entries(stats.languages).sort((a, b) => b[1].size - a[1].size);

  let progress = '';
  let langList = '';

  for (const [index, [lang, data]] of sorted.entries()) {
    const color = data.color ?? '#000000';
    const ratio = index === sorted.length - 1 ? [1, 0] : data.prop > 50 ? [0.99, 0.01] : [0.98, 0.02];

    progress += `<span style="background-color: ${color};width: ${(ratio[0] * data.prop).toFixed(3)}%;margin-right: ${(ratio[1] * data.prop).toFixed(3)}%;" class="progress-item"></span>`;
    langList += `<li style="animation-delay: ${index * 150}ms;">`;
    langList += `<span class="lang">${escapeHtml(lang)}</span>`;
    langList += `<span class="percent">${data.prop.toFixed(2)}%</span></li>`;
  }

  const output = template.replaceAll('{{ progress }}', progress).replaceAll('{{ lang_list }}', langList);
  await atomicWrite(join(outputDir, 'languages.svg'), output);
}
