/**
 * Live smoke test: one fetch_url call against the production API with the key
 * from CRAWLFORGE_API_KEY. Bills 1 credit. Run with `npm run smoke`.
 */
import { CrawlForge, CrawlForgeError } from '../src/index.js';

async function main(): Promise<void> {
  const client = new CrawlForge();
  const result = await client.fetchUrl({ url: 'https://example.com' });
  const status = result.data.status;
  console.log(
    JSON.stringify({
      tool: 'fetch_url',
      creditsUsed: result.creditsUsed,
      creditsRemaining: result.creditsRemaining,
      ...(typeof status === 'number' ? { status } : {}),
      processingTime: result.processingTime,
      warnings: result.warnings,
    }),
  );
}

main().catch((err: unknown) => {
  if (err instanceof CrawlForgeError) {
    console.error(`${err.name} ${err.code} (HTTP ${err.status}): ${err.message}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
