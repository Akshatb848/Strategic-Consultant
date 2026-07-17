import http from 'http';

export type Mode = 'rate_limit' | 'timeout' | 'malformed' | 'ok';

export function startFakeServer(port: number, mode: Mode = 'ok') {
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || !req.url?.startsWith('/chat/completions')) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }

    if (mode === 'rate_limit') {
      res.statusCode = 429;
      res.setHeader('retry-after', '2');
      res.setHeader('content-type', 'text/plain');
      res.end('Rate limit simulated');
      return;
    }

    if (mode === 'timeout') {
      // Intentionally do not respond to simulate a hanging upstream
      // Keep connection open
      return;
    }

    // Read body
    let body = '';
    for await (const chunk of req) body += chunk;

    if (mode === 'malformed') {
      const fakeResp = {
        choices: [
          { message: { content: "{ invalid json: true,, }" } }
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 }
      };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(fakeResp));
      return;
    }

    // ok
    const okResp = {
      choices: [
        { message: { content: JSON.stringify({ foo: 'bar', required: true }) } }
      ],
      usage: { prompt_tokens: 12, completion_tokens: 6 }
    };
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(okResp));
  });

  return new Promise<{ server: http.Server; stop: () => Promise<void> }>((resolve) => {
    server.listen(port, () => {
      resolve({
        server,
        stop: () => new Promise((res) => server.close(() => res(undefined))),
      });
    });
  });
}
