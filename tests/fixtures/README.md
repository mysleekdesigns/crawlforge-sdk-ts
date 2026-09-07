# Recorded fixtures

Each file is `{ "request": <body sent>, "response": { "status", "headers", "body" | "text" | "networkError" | "hang" } }`
and is served by `tests/fixture-server.ts` through the client's `fetch` option: no sockets, no network.

The success bodies (`fetch_url`, `scrape`, `search_web`, `extract_text`, `batch_scrape`, `read_result`,
`extract_links`, `map_site`) are the response examples from the CrawlForge docs
(`crawlforge-website/src/lib/docs/content/en/api-reference/tools/<slug>.ts`, `response.example.data`),
which were dumped from real runs; the `data` payloads are copied unchanged. `request` is the spec's example
body for that tool, except where the recorded response came from a different call: `scrape` is an escalated
run with a highlights and a question format (2 + 1 + 5 = 8 credits) and `batch_scrape` attempted three URLs
(3 x 5 = 15 credits), so those two requests mirror the recorded run instead.

The error bodies follow the website's route code: zod v4 issues for 400, the `api-key-auth` middleware for
401, 402 (with `X-Auto-Recharge-Triggered`) and 429 (`Retry-After: 60` in production; 2 seconds here to
keep the retry test short), the `HOST_BACKOFF` 429 that carries no header, and the `scrape` route's
`BLOCKED` 502 with `blocked` and `escalated`. `error-502-html` is a non-JSON edge error page,
`error-network` a transport failure, and `hang` never answers, for the abort and timeout tests.
