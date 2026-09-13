# Changelog

All notable changes to `crawlforge-sdk` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-09-12

### Added

- `browserSession()` — the `browser_session` tool, an interactive browser
  session held across several calls and driven by an `operation` enum
  (`open | snapshot | act | read | screenshot | close | list`). `snapshot`
  returns an accessibility tree whose interactive elements carry stable refs
  (`@e1`, `@e2` …), and a later call can act on those refs, so a multi-step
  flow no longer has to guess CSS selectors up front the way
  `scrapeWithActions()` does. Billed per operation: `open` 3 credits, `read` 2,
  and 1 each for `snapshot`, `act`, `screenshot`, `close` and `list`.

  Two limits worth knowing before you build on it: a session lives in one
  backend instance's memory and does not survive a redeploy or restart, and a
  REST API key may hold only **one** session at a time — a second `open` is
  refused by name rather than queued, so `close` when you are done instead of
  waiting for the TTL. Persistent login profiles are not available over REST.

## [0.1.1] - 2026-09-07

- Request types regenerated from the corrected OpenAPI specification. Five
  properties the spec had declared as bare objects were typed
  `Record<string, never>` in 0.1.0, which rejected every real value at compile
  time although the API accepted the request: `schema` on `agent()` and
  `extractWithLlm()` (any JSON Schema object), `extractionOptions.selectors` on
  `scrapeWithActions()` (a string map), an action's `position` (`{ x, y }`), and
  the object form of `redact_pii` on `stealthMode()` and `scrapeWithActions()`
  (`entities`, `replace_style`, `mode`). No runtime change.

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
