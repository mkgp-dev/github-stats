function repoQuery(ownedCursor = null, contribCursor = null) {
  const owned = ownedCursor ? `"${ownedCursor}"` : 'null';
  const contrib = contribCursor ? `"${contribCursor}"` : 'null';
  return `
query {
  viewer {
    login
    name
    repositories(first: 100, isFork: false, after: ${owned}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        nameWithOwner
        stargazers { totalCount }
        forkCount
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name color } }
        }
      }
    }
    repositoriesContributedTo(
      first: 100,
      includeUserRepositories: false,
      contributionTypes: [COMMIT, PULL_REQUEST, REPOSITORY, PULL_REQUEST_REVIEW],
      after: ${contrib}
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        nameWithOwner
        stargazers { totalCount }
        forkCount
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name color } }
        }
      }
    }
  }
}`;
}

function yearsQuery() {
  return `query { viewer { contributionsCollection { contributionYears } } }`;
}

function contribByYearQuery(years) {
  const blocks = years
    .map(
      (y) => `
year${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${Number(y) + 1}-01-01T00:00:00Z") {
  contributionCalendar { totalContributions }
}`
    )
    .join('\n');
  return `query { viewer { ${blocks} } }`;
}

function collectLanguages(targetMap, repo, excludedLangs) {
  for (const edge of repo.languages?.edges ?? []) {
    const name = edge?.node?.name ?? 'Other';
    if (excludedLangs.has(name)) continue;
    if (!targetMap[name]) {
      targetMap[name] = { size: 0, occurrences: 0, color: edge?.node?.color ?? '#000000', prop: 0 };
    }
    targetMap[name].size += edge.size ?? 0;
    targetMap[name].occurrences += 1;
  }
}

function computeLanguageProps(languages) {
  const total = Object.values(languages).reduce((acc, lang) => acc + lang.size, 0);
  if (total === 0) return languages;
  for (const lang of Object.values(languages)) {
    lang.prop = (lang.size / total) * 100;
  }
  return languages;
}

export async function collectCoreStats(client, config) {
  const ownedRepos = new Map();
  const contributedRepos = new Map();
  let ownedCursor = null;
  let contribCursor = null;
  let name = config.githubActor;
  let login = config.githubActor;

  while (true) {
    const res = await client.graphql(repoQuery(ownedCursor, contribCursor));
    const viewer = res.data.viewer;
    name = viewer.name || viewer.login;
    login = viewer.login;

    for (const repo of viewer.repositories.nodes ?? []) {
      if (!config.excludedRepos.has(repo.nameWithOwner)) {
        ownedRepos.set(repo.nameWithOwner, repo);
      }
    }

    for (const repo of viewer.repositoriesContributedTo.nodes ?? []) {
      if (!config.excludedRepos.has(repo.nameWithOwner)) {
        contributedRepos.set(repo.nameWithOwner, repo);
      }
    }

    const ownedInfo = viewer.repositories.pageInfo;
    const contribInfo = viewer.repositoriesContributedTo.pageInfo;
    if (!ownedInfo.hasNextPage && !contribInfo.hasNextPage) break;
    ownedCursor = ownedInfo.endCursor;
    contribCursor = contribInfo.endCursor;
  }

  const metricRepos =
    config.repoScope === 'owned_plus_contributed'
      ? [...ownedRepos.values(), ...contributedRepos.values()]
      : [...ownedRepos.values()];

  const langRepos =
    config.langScope === 'owned_plus_contributed'
      ? [...ownedRepos.values(), ...contributedRepos.values()]
      : [...ownedRepos.values()];

  let stars = 0;
  let forks = 0;
  for (const repo of metricRepos) {
    stars += repo.stargazers?.totalCount ?? 0;
    forks += repo.forkCount ?? 0;
  }

  const languages = {};
  for (const repo of langRepos) {
    collectLanguages(languages, repo, config.excludedLangs);
  }
  computeLanguageProps(languages);

  let views = 0;
  for (const repo of ownedRepos.values()) {
    const data = await client.rest(`/repos/${repo.nameWithOwner}/traffic/views`);
    for (const row of data.views ?? []) views += row.count ?? 0;
  }

  const years =
    (await client.graphql(yearsQuery()))?.data?.viewer?.contributionsCollection?.contributionYears ?? [];
  const yearData = (await client.graphql(contribByYearQuery(years)))?.data?.viewer ?? {};
  let contributions = 0;
  for (const key of Object.keys(yearData)) {
    contributions += yearData[key]?.contributionCalendar?.totalContributions ?? 0;
  }

  return {
    name,
    login,
    repoCount: metricRepos.length,
    stars,
    forks,
    contributions,
    views,
    languages,
    linesChanged: null
  };
}
