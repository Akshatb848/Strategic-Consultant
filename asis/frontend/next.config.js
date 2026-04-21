/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  env: {
    // NEXT_PUBLIC_API_URL is the base URL the browser uses for API calls.
    // In production on GCP this is set to http://<VM_IP>:3001 so that all
    // browser requests stay same-origin and are proxied server-side by the
    // /api/v1/[...path]/route.ts handler to the backend Docker service.
    // Falls back to localhost:8000 for local dev without the proxy.
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    NEXT_PUBLIC_APP_NAME: 'ASIS',
    NEXT_PUBLIC_APP_VERSION: '4.0.0',
  },
};

module.exports = nextConfig;
