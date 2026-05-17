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
