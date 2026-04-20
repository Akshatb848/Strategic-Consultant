import { log } from './logger';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

async function braveSearch(query: string, numResults: number): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error('No Brave API key');

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${numResults}`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as {
    web?: {
      results?: Array<{
        title: string;
        url: string;
        description?: string;
        page_age?: string;
      }>;
    };
  };

  const results = data?.web?.results || [];
  return results.map(r => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.description || '',
    publishedDate: r.page_age,
  }));
}

async function tavilySearch(query: string, numResults: number): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('No Tavily API key');

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      num_results: numResults,
      search_depth: 'basic',
      include_answer: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as {
    results?: Array<{
      title: string;
      url: string;
      content?: string;
      published_date?: string;
    }>;
  };

  const results = data?.results || [];
  return results.map(r => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || '',
    publishedDate: r.published_date,
  }));
}

export async function webSearch(query: string, numResults: number = 5): Promise<SearchResult[]> {
  // Try Brave first
  if (process.env.BRAVE_SEARCH_API_KEY) {
    try {
      const results = await braveSearch(query, numResults);
      log.debug('Web search via Brave', { query, count: results.length });
      return results;
    } catch (err) {
      log.warn('Brave Search failed, trying Tavily fallback', { error: String(err) });
    }
  }

  // Fallback to Tavily
  if (process.env.TAVILY_API_KEY) {
    try {
      const results = await tavilySearch(query, numResults);
      log.debug('Web search via Tavily', { query, count: results.length });
      return results;
    } catch (err) {
      log.warn('Tavily Search failed', { error: String(err) });
    }
  }

  // No keys available — return empty array, let agents handle gracefully
  log.debug('No web search API keys configured, returning empty results', { query });
  return [];
}
