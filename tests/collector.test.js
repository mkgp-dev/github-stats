import test from 'node:test';
import assert from 'node:assert/strict';
import { collectCoreStats } from '../src/stats/collector.js';

test('views always use owned repos even when REPO_SCOPE is owned_plus_contributed', async () => {
  const graphqlCalls = [];
  const restCalls = [];

  const client = {
    graphql: async (query) => {
      graphqlCalls.push(query);
      if (query.includes('contributionYears')) {
        return { data: { viewer: { contributionsCollection: { contributionYears: [2025] } } } };
      }
      if (query.includes('year2025')) {
        return {
          data: {
            viewer: {
              year2025: { contributionCalendar: { totalContributions: 9 } }
            }
          }
        };
      }
      return {
        data: {
          viewer: {
            login: 'mkgp',
            name: 'MK',
            repositories: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  nameWithOwner: 'mkgp/owned',
                  stargazers: { totalCount: 2 },
                  forkCount: 1,
                  languages: { edges: [{ size: 100, node: { name: 'JavaScript', color: '#f1e05a' } }] }
                }
              ]
            },
            repositoriesContributedTo: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  nameWithOwner: 'other/contrib',
                  stargazers: { totalCount: 5000 },
                  forkCount: 500,
                  languages: { edges: [{ size: 10, node: { name: 'Go', color: null } }] }
                }
              ]
            }
          }
        }
      };
    },
    rest: async (path) => {
      restCalls.push(path);
      return { views: [{ count: 7 }] };
    }
  };

  const stats = await collectCoreStats(client, {
    githubActor: 'mkgp',
    repoScope: 'owned_plus_contributed',
    langScope: 'owned_plus_contributed',
    excludedRepos: new Set(),
    excludedLangs: new Set()
  });

  assert.equal(stats.views, 7);
  assert.equal(restCalls.length, 1);
  assert.match(restCalls[0], /mkgp\/owned/);
  assert.equal(stats.stars, 5002);
});

test('empty contributionYears skips contrib-by-year query and keeps contributions at 0', async () => {
  const graphqlCalls = [];

  const client = {
    graphql: async (query) => {
      graphqlCalls.push(query);
      if (query.includes('contributionYears')) {
        return { data: { viewer: { contributionsCollection: { contributionYears: [] } } } };
      }
      if (query.includes('contributionsCollection(from:')) {
        throw new Error('should not query contributionsCollection by year when years is empty');
      }
      return {
        data: {
          viewer: {
            login: 'mkgp',
            name: 'MK',
            repositories: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: []
            },
            repositoriesContributedTo: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: []
            }
          }
        }
      };
    },
    rest: async () => ({ views: [] })
  };

  const stats = await collectCoreStats(client, {
    githubActor: 'mkgp',
    repoScope: 'owned_plus_contributed',
    langScope: 'owned_plus_contributed',
    excludedRepos: new Set(),
    excludedLangs: new Set()
  });

  assert.equal(stats.contributions, 0);
  assert.equal(graphqlCalls.some((q) => q.includes('contributionsCollection(from:')), false);
});

test('asymmetric pagination skips completed side and still aggregates correctly', async () => {
  const graphqlCalls = [];
  let page = 0;

  const client = {
    graphql: async (query) => {
      graphqlCalls.push(query);

      if (query.includes('contributionYears')) {
        return { data: { viewer: { contributionsCollection: { contributionYears: [2025] } } } };
      }
      if (query.includes('year2025')) {
        return {
          data: {
            viewer: {
              year2025: { contributionCalendar: { totalContributions: 3 } }
            }
          }
        };
      }

      page += 1;
      if (page === 1) {
        return {
          data: {
            viewer: {
              login: 'mkgp',
              name: 'MK',
              repositories: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [
                  {
                    nameWithOwner: 'mkgp/owned1',
                    stargazers: { totalCount: 1 },
                    forkCount: 1,
                    languages: { edges: [{ size: 20, node: { name: 'JavaScript', color: '#f1e05a' } }] }
                  }
                ]
              },
              repositoriesContributedTo: {
                pageInfo: { hasNextPage: true, endCursor: 'c1' },
                nodes: [
                  {
                    nameWithOwner: 'other/contrib1',
                    stargazers: { totalCount: 2 },
                    forkCount: 2,
                    languages: { edges: [{ size: 10, node: { name: 'Go', color: null } }] }
                  }
                ]
              }
            }
          }
        };
      }

      assert.equal(query.includes('repositoriesContributedTo('), true);
      assert.equal(query.includes('repositories(first: 100, isFork: false'), false);
      return {
        data: {
          viewer: {
            login: 'mkgp',
            name: 'MK',
            repositoriesContributedTo: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  nameWithOwner: 'other/contrib2',
                  stargazers: { totalCount: 3 },
                  forkCount: 4,
                  languages: { edges: [{ size: 5, node: { name: 'Rust', color: '#dea584' } }] }
                }
              ]
            }
          }
        }
      };
    },
    rest: async (path) => {
      assert.match(path, /mkgp\/owned1/);
      return { views: [{ count: 8 }] };
    }
  };

  const stats = await collectCoreStats(client, {
    githubActor: 'mkgp',
    repoScope: 'owned_plus_contributed',
    langScope: 'owned_plus_contributed',
    excludedRepos: new Set(),
    excludedLangs: new Set()
  });

  assert.equal(stats.repoCount, 3);
  assert.equal(stats.stars, 6);
  assert.equal(stats.forks, 7);
  assert.equal(stats.views, 8);
  assert.equal(stats.contributions, 3);
});

test('dedupes overlap between owned and contributed repos for metrics and languages', async () => {
  const client = {
    graphql: async (query) => {
      if (query.includes('contributionYears')) {
        return { data: { viewer: { contributionsCollection: { contributionYears: [] } } } };
      }
      if (query.includes('contributionsCollection(from:')) {
        throw new Error('unexpected per-year query when years are empty');
      }
      return {
        data: {
          viewer: {
            login: 'mkgp',
            name: 'MK',
            repositories: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  nameWithOwner: 'mkgp/shared',
                  stargazers: { totalCount: 10 },
                  forkCount: 4,
                  languages: { edges: [{ size: 100, node: { name: 'JavaScript', color: '#f1e05a' } }] }
                },
                {
                  nameWithOwner: 'mkgp/owned-only',
                  stargazers: { totalCount: 1 },
                  forkCount: 1,
                  languages: { edges: [{ size: 50, node: { name: 'TypeScript', color: '#3178c6' } }] }
                }
              ]
            },
            repositoriesContributedTo: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  nameWithOwner: 'mkgp/shared',
                  stargazers: { totalCount: 999 },
                  forkCount: 999,
                  languages: { edges: [{ size: 999, node: { name: 'JavaScript', color: '#f1e05a' } }] }
                },
                {
                  nameWithOwner: 'other/contrib-only',
                  stargazers: { totalCount: 2 },
                  forkCount: 3,
                  languages: { edges: [{ size: 25, node: { name: 'Go', color: '#00add8' } }] }
                }
              ]
            }
          }
        }
      };
    },
    rest: async () => ({ views: [{ count: 1 }] })
  };

  const stats = await collectCoreStats(client, {
    githubActor: 'mkgp',
    repoScope: 'owned_plus_contributed',
    langScope: 'owned_plus_contributed',
    excludedRepos: new Set(),
    excludedLangs: new Set()
  });

  assert.equal(stats.repoCount, 3);
  assert.equal(stats.stars, 13);
  assert.equal(stats.forks, 8);
  assert.equal(stats.languages.JavaScript.size, 100);
  assert.equal(stats.languages.TypeScript.size, 50);
  assert.equal(stats.languages.Go.size, 25);
});

test('language fallback/percent contract and deterministic repo name sets', async () => {
  const client = {
    graphql: async (query) => {
      if (query.includes('contributionYears')) {
        return { data: { viewer: { contributionsCollection: { contributionYears: [] } } } };
      }

      return {
        data: {
          viewer: {
            login: 'mkgp',
            name: 'MK',
            repositories: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  nameWithOwner: 'mkgp/a-owned',
                  stargazers: { totalCount: 1 },
                  forkCount: 1,
                  languages: {
                    edges: [
                      { size: 60, node: { name: 'Go', color: null } },
                      { size: 40, node: { name: 'JavaScript', color: '#f1e05a' } }
                    ]
                  }
                },
                {
                  nameWithOwner: 'mkgp/b-owned',
                  stargazers: { totalCount: 2 },
                  forkCount: 1,
                  languages: {
                    edges: [{ size: 20, node: { name: 'TypeScript', color: '#3178c6' } }]
                  }
                }
              ]
            },
            repositoriesContributedTo: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  nameWithOwner: 'other/z-contrib',
                  stargazers: { totalCount: 3 },
                  forkCount: 2,
                  languages: {
                    edges: [{ size: 10, node: { name: 'Rust', color: '#dea584' } }]
                  }
                }
              ]
            }
          }
        }
      };
    },
    rest: async () => ({ views: [{ count: 0 }] })
  };

  const stats = await collectCoreStats(client, {
    githubActor: 'mkgp',
    repoScope: 'owned_plus_contributed',
    langScope: 'owned',
    excludedRepos: new Set(),
    excludedLangs: new Set()
  });

  assert.equal(stats.languages.Go.color, '#000000');
  const propSum = Object.values(stats.languages).reduce((sum, lang) => sum + lang.prop, 0);
  assert.ok(propSum > 99.99 && propSum < 100.01);

  assert.deepEqual(stats.ownedRepoNames, ['mkgp/a-owned', 'mkgp/b-owned']);
  assert.deepEqual(stats.contributedRepoNames, ['other/z-contrib']);
  assert.deepEqual(stats.repoNamesForLines, ['mkgp/a-owned', 'mkgp/b-owned', 'other/z-contrib']);
});

test('repoNamesForLines dedupes overlaps with deterministic owned-first order', async () => {
  const client = {
    graphql: async (query) => {
      if (query.includes('contributionYears')) {
        return { data: { viewer: { contributionsCollection: { contributionYears: [] } } } };
      }

      return {
        data: {
          viewer: {
            login: 'mkgp',
            name: 'MK',
            repositories: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  nameWithOwner: 'mkgp/a-owned',
                  stargazers: { totalCount: 1 },
                  forkCount: 0,
                  languages: { edges: [] }
                },
                {
                  nameWithOwner: 'mkgp/shared',
                  stargazers: { totalCount: 1 },
                  forkCount: 0,
                  languages: { edges: [] }
                }
              ]
            },
            repositoriesContributedTo: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  nameWithOwner: 'mkgp/shared',
                  stargazers: { totalCount: 999 },
                  forkCount: 999,
                  languages: { edges: [] }
                },
                {
                  nameWithOwner: 'other/z-contrib',
                  stargazers: { totalCount: 1 },
                  forkCount: 0,
                  languages: { edges: [] }
                }
              ]
            }
          }
        }
      };
    },
    rest: async () => ({ views: [] })
  };

  const stats = await collectCoreStats(client, {
    githubActor: 'mkgp',
    repoScope: 'owned_plus_contributed',
    langScope: 'owned',
    excludedRepos: new Set(),
    excludedLangs: new Set()
  });

  assert.deepEqual(stats.ownedRepoNames, ['mkgp/a-owned', 'mkgp/shared']);
  assert.deepEqual(stats.contributedRepoNames, ['mkgp/shared', 'other/z-contrib']);
  assert.deepEqual(stats.repoNamesForLines, ['mkgp/a-owned', 'mkgp/shared', 'other/z-contrib']);
});
