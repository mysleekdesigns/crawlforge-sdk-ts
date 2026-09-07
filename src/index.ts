export { CrawlForge, DEFAULT_BASE_URL, USER_AGENT, parseRetryAfter } from './client.js';
export type { CrawlForgeOptions, ErrorResponse, FetchLike, ToolInfo, ToolSuccess } from './client.js';
export type { RequestOptions, ToolResult } from './types.js';
export {
  AuthenticationError,
  CrawlForgeError,
  InsufficientCreditsError,
  RateLimitError,
  ToolError,
  ValidationError,
} from './errors.js';
export type { BlockedInfo, CrawlForgeErrorOptions } from './errors.js';
export { TOOLS } from './generated/tools.js';
export type { ToolMethodName, ToolName } from './generated/tools.js';
export { VERSION } from './version.js';

// One alias per tool, kept current by scripts/gen-tools.mjs.
// generated:request-types:start
export type {
  AgentRequest,
  AnalyzeContentRequest,
  BatchScrapeRequest,
  CrawlDeepRequest,
  DeepResearchRequest,
  ExtractContentRequest,
  ExtractEmbeddedStateRequest,
  ExtractLinksRequest,
  ExtractMetadataRequest,
  ExtractStructuredRequest,
  ExtractTextRequest,
  ExtractWithLlmRequest,
  FetchUrlRequest,
  GenerateLlmsTxtRequest,
  GetBatchResultsRequest,
  ListOllamaModelsRequest,
  LocalizationRequest,
  MapSiteRequest,
  ProcessDocumentRequest,
  ReadResultRequest,
  RedditSearchRequest,
  ScrapeRequest,
  ScrapeStructuredRequest,
  ScrapeTemplateRequest,
  ScrapeWithActionsRequest,
  SearchWebRequest,
  SerpRankRequest,
  StealthModeRequest,
  SummarizeContentRequest,
  TrackChangesRequest,
} from './generated/tools.js';
// generated:request-types:end
