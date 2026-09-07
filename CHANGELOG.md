# Changelog

All notable changes to `crawlforge-sdk` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-09-07

Initial release.

- `CrawlForge` client with one typed method per tool (30 tools), generated from
  the CrawlForge OpenAPI specification, plus `call(tool, params)` and
  `describe(tool)`.
- Typed errors: `ValidationError` (400), `AuthenticationError` (401),
  `InsufficientCreditsError` (402, with `autoRechargeTriggered`),
  `RateLimitError` (429, with `retryAfter`) and `ToolError` (everything else,
  with `blocked` and `escalated`); `CrawlForgeError` for transport failures.
- Retries on 429 only, honouring `Retry-After` (capped at 60 s) with jittered
  exponential backoff otherwise; `maxRetries` defaults to 2.
- `creditsUsed` and `creditsRemaining` on every result.
- ESM and CJS builds with type declarations; no runtime dependencies; `fetch`
  only, so it runs on Node 18+ and edge runtimes.
