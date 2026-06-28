function repoQuery({
  ownedCursor = null,
  contribCursor = null,
  includeOwned = true,
  includeContrib = true
} = {}) {
  const owned = ownedCursor ? `"${ownedCursor}"` : 'null';
  const contrib = contribCursor ? `"${contribCursor}"` : 'null';
  const ownedBlock = includeOwned
    ? `
    repositories(first: 100, isFork: false, after: ${owned}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        nameWithOwner
        owner { login }
        stargazers { totalCount }
        forkCount
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name color } }
        }
      }
    }`
    : '';
  const contribBlock = includeContrib
    ? `
    repositoriesContributedTo(
      first: 100,
      includeUserRepositories: false,
      contributionTypes: [COMMIT, PULL_REQUEST, REPOSITORY, PULL_REQUEST_REVIEW],
      after: ${contrib}
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        nameWithOwner
        owner { login }
        stargazers { totalCount }
        forkCount
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name color } }
        }
      }
    }`
    : '';
  return `
query {
  viewer {
    login
    name
    ${ownedBlock}
    ${contribBlock}
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

function mergeUniqueRepos(primaryRepos, secondaryRepos) {
  const merged = new Map();
  for (const repo of primaryRepos) {
    merged.set(repo.nameWithOwner, repo);
  }
  for (const repo of secondaryRepos) {
    if (!merged.has(repo.nameWithOwner)) {
      merged.set(repo.nameWithOwner, repo);
    }
  }
  return [...merged.values()];
}

function mergeUniqueNames(primaryNames, secondaryNames) {
  const merged = new Set(primaryNames);
  for (const name of secondaryNames) {
    if (!merged.has(name)) {
      merged.add(name);
    }
  }
  return [...merged];
}

function ownerLogin(repo) {
  return (repo.owner?.login ?? repo.nameWithOwner?.split('/')[0] ?? '').toLowerCase();
}

function isMetricOwner(repo, config) {
  const metricOwners = config.metricOwners ?? new Set([config.githubActor]);
  return metricOwners.has(ownerLogin(repo));
}

function traceLanguages(repo) {
  return (repo.languages?.edges ?? []).map((edge) => ({
    name: edge?.node?.name ?? 'Other',
    size: edge?.size ?? 0,
    color: edge?.node?.color ?? '#000000'
  }));
}

function traceRepo(repo, extra = {}) {
  return {
    nameWithOwner: repo.nameWithOwner,
    stars: repo.stargazers?.totalCount ?? 0,
    forks: repo.forkCount ?? 0,
    ...extra,
    languages: traceLanguages(repo)
  };
}

export async function collectCoreStats(client, config) {
  const ownedRepos = new Map();
  const contributedRepos = new Map();
  const ownedRepoViews = new Map();
  let ownedCursor = null;
  let contribCursor = null;
  let hasMoreOwned = true;
  let hasMoreContrib = true;
  let name = config.githubActor;
  let login = config.githubActor;

  while (hasMoreOwned || hasMoreContrib) {
    const res = await client.graphql(
      repoQuery({
        ownedCursor,
        contribCursor,
        includeOwned: hasMoreOwned,
        includeContrib: hasMoreContrib
      })
    );
    const viewer = res.data.viewer;
    name = viewer.name || viewer.login;
    login = viewer.login;

    if (hasMoreOwned) {
      for (const repo of viewer.repositories?.nodes ?? []) {
        if (!config.excludedRepos.has(repo.nameWithOwner)) {
          ownedRepos.set(repo.nameWithOwner, repo);
        }
      }
      const ownedInfo = viewer.repositories?.pageInfo ?? { hasNextPage: false, endCursor: null };
      hasMoreOwned = ownedInfo.hasNextPage;
      ownedCursor = ownedInfo.endCursor;
    }

    if (hasMoreContrib) {
      for (const repo of viewer.repositoriesContributedTo?.nodes ?? []) {
        if (!config.excludedRepos.has(repo.nameWithOwner)) {
          contributedRepos.set(repo.nameWithOwner, repo);
        }
      }
      const contribInfo = viewer.repositoriesContributedTo?.pageInfo ?? { hasNextPage: false, endCursor: null };
      hasMoreContrib = contribInfo.hasNextPage;
      contribCursor = contribInfo.endCursor;
    }
  }

  const metricRepos = [...ownedRepos.values()].filter((repo) => isMetricOwner(repo, config));

  const langRepos =
    config.langScope === 'owned_plus_contributed'
      ? mergeUniqueRepos(ownedRepos.values(), contributedRepos.values())
      : [...ownedRepos.values()];

  const { stars, forks } = metricRepos.reduce(
    (totals, repo) => ({
      stars: totals.stars + (repo.stargazers?.totalCount ?? 0),
      forks: totals.forks + (repo.forkCount ?? 0)
    }),
    { stars: 0, forks: 0 }
  );

  const languages = {};
  for (const repo of langRepos) {
    collectLanguages(languages, repo, config.excludedLangs);
  }
  computeLanguageProps(languages);

  let views = 0;
  for (const repo of ownedRepos.values()) {
    const data = await client.rest(`/repos/${repo.nameWithOwner}/traffic/views`);
    const repoViews = (data.views ?? []).reduce((sum, row) => sum + (row.count ?? 0), 0);
    ownedRepoViews.set(repo.nameWithOwner, repoViews);
    views += repoViews;
  }

  const years =
    (await client.graphql(yearsQuery()))?.data?.viewer?.contributionsCollection?.contributionYears ?? [];
  let contributions = 0;
  if (years.length > 0) {
    const yearData = (await client.graphql(contribByYearQuery(years)))?.data?.viewer ?? {};
    contributions = Object.values(yearData).reduce(
      (sum, entry) => sum + (entry?.contributionCalendar?.totalContributions ?? 0),
      0
    );
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
    linesChanged: null,
    ownedRepoNames: [...ownedRepos.keys()],
    contributedRepoNames: [...contributedRepos.keys()],
    repoNamesForLines:
      config.repoScope === 'owned_plus_contributed'
        ? mergeUniqueNames(ownedRepos.keys(), contributedRepos.keys())
        : [...ownedRepos.keys()],
    sources: {
      ownedRepos: [...ownedRepos.values()].map((repo) =>
        traceRepo(repo, { views: ownedRepoViews.get(repo.nameWithOwner) ?? 0 })
      ),
      contributedRepos: [...contributedRepos.values()].map((repo) => traceRepo(repo)),
      metricRepos: metricRepos.map((repo) =>
        traceRepo(
          repo,
          ownedRepoViews.has(repo.nameWithOwner)
            ? { views: ownedRepoViews.get(repo.nameWithOwner) ?? 0 }
            : {}
        )
      ),
      languageRepos: langRepos.map((repo) =>
        traceRepo(
          repo,
          ownedRepoViews.has(repo.nameWithOwner)
            ? { views: ownedRepoViews.get(repo.nameWithOwner) ?? 0 }
            : {}
        )
      )
    }
  };
}
