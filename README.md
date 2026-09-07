# crawlforge-sdk

The official TypeScript SDK for the [CrawlForge REST API](https://www.crawlforge.dev/docs/api-reference):
30 metered web tools (fetch, scrape, search, crawl, extract, research) behind one API key.

- One typed method per tool, generated from the [OpenAPI specification](https://www.crawlforge.dev/openapi.json).
- Typed errors for validation, authentication, credits, rate limits and tool failures.
- Retries on 429 only, honouring `Retry-After`.
- `creditsUsed` and `creditsRemaining` on every result.
- ESM and CJS, no runtime dependencies, `fetch` only: Node 18+ and edge runtimes.

API keys: https://www.crawlforge.dev/dashboard/keys

## Install

```bash
npm install crawlforge-sdk
```

## Quick start

```ts
import { CrawlForge } from 'crawlforge-sdk';

const client = new CrawlForge({ apiKey: process.env.CRAWLFORGE_API_KEY });

const page = await client.scrape({
  url: 'https://example.com',
  formats: ['markdown', 'links'],
});

console.log(page.data.formats);        // tool-specific payload
console.log(page.creditsUsed);         // 2
console.log(page.creditsRemaining);    // your balance after this call
```

`new CrawlForge()` with no options reads `CRAWLFORGE_API_KEY` from the environment when a `process.env`
exists, and throws a `CrawlForgeError` (code `MISSING_API_KEY`) at construction when no key is found.

### Options

```ts
new CrawlForge({
  apiKey: '...',                                   // or CRAWLFORGE_API_KEY
  baseUrl: 'https://www.crawlforge.dev/api/v1',   // default
  maxRetries: 2,                                   // retries after a 429; 2 = up to three requests
  timeoutMs: 60_000,                               // per attempt
  fetch: customFetch,                              // replaces globalThis.fetch
});
```

Every method also takes per-call options: `{ signal?: AbortSignal; timeoutMs?: number; maxRetries?: number }`.

```ts
const controller = new AbortController();
const result = await client.searchWeb({ query: 'web scraping' }, { signal: controller.signal, timeoutMs: 20_000 });
```

## Tools

One method per tool. `credits` is each tool's base price from the spec; a tool with a per-unit or
conditional price says so in the credits column and on its docs page. Request parameters are typed
(`ScrapeRequest`, `SearchWebRequest`, ...); the `data` of a result is tool-specific and typed as
`Record<string, unknown>` in this release, so read the response shape on the tool's docs page.

<!-- generated:tools:start -->
| Method | Tool | Credits | Docs |
|---|---|---|---|
| `agent()` | `agent` | 8 | [agent](https://www.crawlforge.dev/docs/api-reference/tools/agent) |
| `analyzeContent()` | `analyze_content` | 3 | [analyze_content](https://www.crawlforge.dev/docs/api-reference/tools/analyze-content) |
| `batchScrape()` | `batch_scrape` | 5; 5 per URL attempted (skipped URLs are not charged) | [batch_scrape](https://www.crawlforge.dev/docs/api-reference/tools/batch-scrape) |
| `crawlDeep()` | `crawl_deep` | 4 | [crawl_deep](https://www.crawlforge.dev/docs/api-reference/tools/crawl-deep) |
| `deepResearch()` | `deep_research` | 10 | [deep_research](https://www.crawlforge.dev/docs/api-reference/tools/deep-research) |
| `extractContent()` | `extract_content` | 2 | [extract_content](https://www.crawlforge.dev/docs/api-reference/tools/extract-content) |
| `extractEmbeddedState()` | `extract_embedded_state` | 2 | [extract_embedded_state](https://www.crawlforge.dev/docs/api-reference/tools/extract-embedded-state) |
| `extractLinks()` | `extract_links` | 1 | [extract_links](https://www.crawlforge.dev/docs/api-reference/tools/extract-links) |
| `extractMetadata()` | `extract_metadata` | 1 | [extract_metadata](https://www.crawlforge.dev/docs/api-reference/tools/extract-metadata) |
| `extractStructured()` | `extract_structured` | 3 | [extract_structured](https://www.crawlforge.dev/docs/api-reference/tools/extract-structured) |
| `extractText()` | `extract_text` | 1 | [extract_text](https://www.crawlforge.dev/docs/api-reference/tools/extract-text) |
| `extractWithLlm()` | `extract_with_llm` | 3 | [extract_with_llm](https://www.crawlforge.dev/docs/api-reference/tools/extract-with-llm) |
| `fetchUrl()` | `fetch_url` | 1 | [fetch_url](https://www.crawlforge.dev/docs/api-reference/tools/fetch-url) |
| `generateLlmsTxt()` | `generate_llms_txt` | 5 | [generate_llms_txt](https://www.crawlforge.dev/docs/api-reference/tools/generate-llms-txt) |
| `getBatchResults()` | `get_batch_results` | 1 | [get_batch_results](https://www.crawlforge.dev/docs/api-reference/tools/get-batch-results) |
| `listOllamaModels()` | `list_ollama_models` | 1 | [list_ollama_models](https://www.crawlforge.dev/docs/api-reference/tools/list-ollama-models) |
| `localization()` | `localization` | 2 | [localization](https://www.crawlforge.dev/docs/api-reference/tools/localization) |
| `mapSite()` | `map_site` | 2 | [map_site](https://www.crawlforge.dev/docs/api-reference/tools/map-site) |
| `processDocument()` | `process_document` | 2 | [process_document](https://www.crawlforge.dev/docs/api-reference/tools/process-document) |
| `readResult()` | `read_result` | 1 | [read_result](https://www.crawlforge.dev/docs/api-reference/tools/read-result) |
| `redditSearch()` | `reddit_search` | 5 | [reddit_search](https://www.crawlforge.dev/docs/api-reference/tools/reddit-search) |
| `scrape()` | `scrape` | 2 | [scrape](https://www.crawlforge.dev/docs/api-reference/tools/scrape) |
| `scrapeStructured()` | `scrape_structured` | 2 | [scrape_structured](https://www.crawlforge.dev/docs/api-reference/tools/scrape-structured) |
| `scrapeTemplate()` | `scrape_template` | 1 | [scrape_template](https://www.crawlforge.dev/docs/api-reference/tools/scrape-template) |
| `scrapeWithActions()` | `scrape_with_actions` | 5 | [scrape_with_actions](https://www.crawlforge.dev/docs/api-reference/tools/scrape-with-actions) |
| `searchWeb()` | `search_web` | 5 | [search_web](https://www.crawlforge.dev/docs/api-reference/tools/search-web) |
| `serpRank()` | `serp_rank` | 5 | [serp_rank](https://www.crawlforge.dev/docs/api-reference/tools/serp-rank) |
| `stealthMode()` | `stealth_mode` | 5 | [stealth_mode](https://www.crawlforge.dev/docs/api-reference/tools/stealth-mode) |
| `summarizeContent()` | `summarize_content` | 4 | [summarize_content](https://www.crawlforge.dev/docs/api-reference/tools/summarize-content) |
| `trackChanges()` | `track_changes` | 3 | [track_changes](https://www.crawlforge.dev/docs/api-reference/tools/track-changes) |
<!-- generated:tools:end -->

Any tool can also be called by name, and its self-description fetched without a key:

```ts
const result = await client.call('fetch_url', { url: 'https://example.com' });
const info = await client.describe('fetch_url'); // price, JSON Schema, example body
```

The `TOOLS` export lists every tool with its method name, credits and docs URL.

## Results

Every call resolves to a `ToolResult`:

```ts
interface ToolResult<T = Record<string, unknown>> {
  data: T;                  // the tool's payload
  creditsUsed: number;      // charged for this call
  creditsRemaining: number; // balance after this call
  processingTime: number;   // server-side, in ms
  warnings: string[];       // non-fatal notes; [] when there are none
}
```

`client.call<T>()` accepts a type argument for `data` when you know a tool's shape:

```ts
const page = await client.call<{ status: number; content: string }>('fetch_url', { url: 'https://example.com' });
page.data.status; // number
```

## Errors

Every failure throws a subclass of `CrawlForgeError` with `status`, `code`, `message`, `details` and, when
the response carried one, `requestId`. Credits are deducted only after a call succeeds, so an error
response never charges.

| Status | Class | Extra fields |
|---|---|---|
| 400 | `ValidationError` | `details` is the validation issue list |
| 401 | `AuthenticationError` | |
| 402 | `InsufficientCreditsError` | `autoRechargeTriggered` (from `X-Auto-Recharge-Triggered`) |
| 429 | `RateLimitError` | `retryAfter` in seconds, or `null` without a `Retry-After` header |
| other | `ToolError` | `blocked` (`{ vendor, evidence }` or `null`), `escalated` |

A response that is not JSON (an edge error page) becomes a `CrawlForgeError` with code
`UNEXPECTED_RESPONSE` and the raw body in `details`; a transport failure has code `NETWORK_ERROR` and
status 0; a per-attempt timeout has code `TIMEOUT`. An `AbortSignal` you pass rejects with its own reason.

```ts
import { CrawlForge, InsufficientCreditsError, RateLimitError, ValidationError } from 'crawlforge-sdk';

try {
  await client.fetchUrl({ url: 'not a url' });
} catch (err) {
  if (err instanceof ValidationError) console.error(err.details);           // what was wrong
  else if (err instanceof InsufficientCreditsError) console.error(err.autoRechargeTriggered);
  else if (err instanceof RateLimitError) console.error(err.retryAfter);   // seconds, or null
  else throw err;
}
```

Errors never contain the API key.

## Retries

Only a 429 is retried. The client waits `Retry-After` seconds when the header is present (integer or
HTTP date, capped at 60 s), otherwise 1 s, 2 s, 4 s ... with ±20 % jitter. `maxRetries` counts retries,
not attempts: the default of 2 allows three requests, after which the `RateLimitError` is thrown. Both
`RATE_LIMIT_EXCEEDED` (your plan's limit) and `HOST_BACKOFF` (the target site asked CrawlForge to wait)
are 429s; `code` tells them apart. A 5xx is never retried: a failed call is not charged, but a repeat
would run the tool again.

## Runtimes

The client uses only `fetch`, `AbortController` and timers, with no Node built-ins, so it runs on
Node 18+ and on edge runtimes that provide those globals (Cloudflare Workers, Vercel Edge Functions,
Deno, Bun). CI exercises Node 18, 20 and 22. Pass `{ fetch }` to use a different implementation.

Keep the API key server-side: a browser would ship it to every visitor.

## Spec and generated code

`openapi.json` in this repository is the published specification; `src/generated/` is produced from it
by `npm run generate` (types by [openapi-typescript](https://github.com/openapi-ts/openapi-typescript),
the tool table and methods by `scripts/gen-tools.mjs`). Request types are the `properties` view of each
request schema: cross-field rules such as "one of `url` or `html`" are enforced by the API and noted in
each method's JSDoc.

- API reference: https://www.crawlforge.dev/docs/api-reference
- OpenAPI specification: https://www.crawlforge.dev/openapi.json
- API keys: https://www.crawlforge.dev/dashboard/keys

## License

MIT
