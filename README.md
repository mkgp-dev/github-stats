> [!NOTE]
> The original repository did not solve this “almost 2 hours” GitHub Actions runtime, so I ported it to JavaScript (*since it’s my main language*) to address the issue while also improving efficiency, performance and reliability, and accuracy and correctness.

> [!IMPORTANT]
> See [MIGRATION](MIGRATION.md) for upgrade and compatibility notes.

> [!IMPORTANT]
> See [INSTRUCTIONS](INSTRUCTIONS.md) for guidance on using this repository.

# github-stats

Automatically generate transparent GitHub statistic cards with JavaScript.

![](https://raw.githubusercontent.com/mkgp-dev/github-stats/output/generated/overview.svg)
![](https://raw.githubusercontent.com/mkgp-dev/github-stats/output/generated/languages.svg)

## Metric Owners

Stars, forks, and repository count use `METRIC_OWNERS` to decide which repository owners count toward aggregate metrics. By default, it uses `GITHUB_ACTOR`, so only repositories under your personal profile count.

Set `METRIC_OWNERS` to a comma-separated owner allowlist when you also want selected organization repositories counted:

```env
METRIC_OWNERS=mkgp-dev,ternilabs
```

Owner matching is case-insensitive. Use the `summary.login` value from `result.json` for your personal owner.

Use `EXCLUDED_REPOS` to remove specific repositories from collection even when their owner is allowed.

## Credits

- [rahul-jha98/github-stats-transparent](https://github.com/rahul-jha98/github-stats-transparent)
- [BotBlake/github-stats-transparent](https://github.com/BotBlake/github-stats-transparent)

## License

This project is licensed under the **GNU General Public License v3.0** (GPL-3.0). You are free to use, modify, and redistribute it, provided that any derivative works are also distributed under the same GPL-3.0 license. See the [LICENSE](LICENSE) file for full details.
