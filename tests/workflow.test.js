import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('workflow runs node generator instead of python', async () => {
  const yaml = await readFile('.github/workflows/main.yml', 'utf8');

  assert.match(yaml, /actions\/setup-node/);
  assert.match(yaml, /node-version:\s*["']22["']/);
  assert.doesNotMatch(yaml, /node-version:\s*["']20["']/);
  assert.match(yaml, /npm ci/);
  assert.match(yaml, /npm run generate/);

  assert.doesNotMatch(yaml, /setup-python/);
  assert.doesNotMatch(yaml, /pip install/);
  assert.doesNotMatch(yaml, /generate_images\.py/);

  assert.match(yaml, /GITHUB_ACTOR:\s*\$\{\{\s*secrets\.GH_STATS_ACTOR\s*\}\}/);
  assert.match(yaml, /METRIC_OWNERS:\s*\$\{\{\s*secrets\.METRIC_OWNERS\s*\}\}/);
  assert.doesNotMatch(yaml, /GITHUB_ACTOR:\s*\$\{\{\s*github\.actor\s*\}\}/);

  assert.match(yaml, /cp -R "\$RUNNER_TEMP\/github-stats-output\/generated" "\.\/generated"/);
  assert.match(
    yaml,
    /fi\n\n        rm -rf generated result\.json\n        cp -R "\$RUNNER_TEMP\/github-stats-output\/generated" "\.\/generated"/
  );
  assert.match(yaml, /cp "\$RUNNER_TEMP\/github-stats-output\/result\.json" "result\.json"/);
  assert.match(yaml, /if \[ ! -f README\.md \]; then/);
  assert.match(yaml, /https:\/\/raw\.githubusercontent\.com\/\$\{GITHUB_REPOSITORY\}\/output\/generated\/overview\.svg/);
  assert.match(yaml, /https:\/\/raw\.githubusercontent\.com\/\$\{GITHUB_REPOSITORY\}\/output\/generated\/languages\.svg/);
  assert.match(yaml, /https:\/\/raw\.githubusercontent\.com\/\$\{GITHUB_REPOSITORY\}\/output\/result\.json/);
  assert.match(yaml, /\\`\\`\\`md/);
  assert.match(yaml, /!\[GitHub Stats Overview\]/);
  assert.match(yaml, /!\[Most Used Languages\]/);

  const lines = yaml.split('\n');
  const readmeStart = lines.findIndex((line) => line.includes('cat > README.md <<EOF'));
  const readmeEnd = lines.findIndex((line, index) => index > readmeStart && line.trim() === 'EOF');

  assert.notEqual(readmeStart, -1);
  assert.notEqual(readmeEnd, -1);
  for (const line of lines.slice(readmeStart + 1, readmeEnd + 1)) {
    if (line !== '') assert.match(line, /^        /);
  }
});
