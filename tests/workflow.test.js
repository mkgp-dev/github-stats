import test from 'ava';
import { readFile } from 'node:fs/promises';

test('workflow runs node generator instead of python', async (t) => {
  const yaml = await readFile('.github/workflows/main.yml', 'utf8');

  t.regex(yaml, /actions\/setup-node/);
  t.regex(yaml, /node-version:\s*["']22["']/);
  t.notRegex(yaml, /node-version:\s*["']20["']/);
  t.regex(yaml, /npm ci/);
  t.regex(yaml, /npm test/);
  t.regex(yaml, /npm run generate/);

  t.notRegex(yaml, /setup-python/);
  t.notRegex(yaml, /pip install/);
  t.notRegex(yaml, /generate_images\.py/);

  t.regex(yaml, /GITHUB_ACTOR:\s*\$\{\{\s*secrets\.GH_STATS_ACTOR\s*\}\}/);
  t.regex(yaml, /METRIC_OWNERS:\s*\$\{\{\s*secrets\.METRIC_OWNERS\s*\}\}/);
  t.notRegex(yaml, /GITHUB_ACTOR:\s*\$\{\{\s*github\.actor\s*\}\}/);

  t.regex(yaml, /cp -R "\$RUNNER_TEMP\/github-stats-output\/generated" "\.\/generated"/);
  t.regex(
    yaml,
    /fi\n\n        rm -rf generated result\.json\n        cp -R "\$RUNNER_TEMP\/github-stats-output\/generated" "\.\/generated"/
  );
  t.regex(yaml, /cp "\$RUNNER_TEMP\/github-stats-output\/result\.json" "result\.json"/);
  t.regex(yaml, /if \[ ! -f README\.md \]; then/);
  t.regex(yaml, /https:\/\/raw\.githubusercontent\.com\/\$\{GITHUB_REPOSITORY\}\/output\/generated\/overview\.svg/);
  t.regex(yaml, /https:\/\/raw\.githubusercontent\.com\/\$\{GITHUB_REPOSITORY\}\/output\/generated\/languages\.svg/);
  t.regex(yaml, /https:\/\/raw\.githubusercontent\.com\/\$\{GITHUB_REPOSITORY\}\/output\/result\.json/);
  t.regex(yaml, /\\`\\`\\`md/);
  t.regex(yaml, /!\[GitHub Stats Overview\]/);
  t.regex(yaml, /!\[Most Used Languages\]/);

  const lines = yaml.split('\n');
  const readmeStart = lines.findIndex((line) => line.includes('cat > README.md <<EOF'));
  const readmeEnd = lines.findIndex((line, index) => index > readmeStart && line.trim() === 'EOF');

  t.not(readmeStart, -1);
  t.not(readmeEnd, -1);
  for (const line of lines.slice(readmeStart + 1, readmeEnd + 1)) {
    if (line !== '') t.regex(line, /^        /);
  }
});
