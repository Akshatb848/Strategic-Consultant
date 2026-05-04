/**
 * ASIS API Proxy Route
 *
 * Proxies all /api/v1/* browser requests to the Python FastAPI backend.
 * Because the browser only connects to the Next.js server (same origin),
 * no CORS headers are required on the backend.
 *
 * BACKEND_INTERNAL_URL is set to http://backend:8000 in docker-compose so that
 * the frontend container reaches the backend via the internal Docker network.
 * Falls back to NEXT_PUBLIC_API_URL for local development.
 */
import { type NextRequest, NextResponse } from "next/server";

const BACKEND = (
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
).replace(/\/$/, ""); // strip trailing slash

/** Headers we must NOT forward to the backend (hop-by-hop + host). */
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

const FORWARDED_REQUEST_HEADERS = new Set([
  "accept",
  "authorization",
  "content-type",
  "cookie",
  "x-request-id",
]);

function buildUpstreamHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();
    if (!HOP_BY_HOP.has(normalizedKey) && FORWARDED_REQUEST_HEADERS.has(normalizedKey)) {
      headers.set(key, value);
    }
  });
  return headers;
}

function buildDownstreamHeaders(upstreamHeaders: Headers): Headers {
  const headers = new Headers();
  upstreamHeaders.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  return headers;
}

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const path = (await params).path.join("/");
  const search = req.nextUrl.search;
  const upstreamUrl = `${BACKEND}/api/v1/${path}${search}`;

  const isSSE =
    req.headers.get("accept")?.includes("text/event-stream") ?? false;

  const hasBody = ["POST", "PUT", "PATCH"].includes(req.method);
  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers: buildUpstreamHeaders(req),
    // Required for streaming responses in Node.js 20+.
    ...(isSSE ? { cache: "no-store" } : {}),
  };
  if (hasBody) {
    init.body = Buffer.from(await req.arrayBuffer());
    init.duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, init);
  } catch (err) {
    console.error(`[proxy] upstream fetch failed for ${upstreamUrl}:`, err);
    return NextResponse.json(
      { detail: "Backend unreachable." },
      { status: 503 }
    );
  }

  const downstreamHeaders = buildDownstreamHeaders(upstream.headers);

  // Stream SSE responses directly so events arrive in real-time.
  if (isSSE && upstream.body) {
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: downstreamHeaders,
    });
  }

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: upstream.status,
    headers: downstreamHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;

// Required for SSE streaming in Next.js App Router
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
