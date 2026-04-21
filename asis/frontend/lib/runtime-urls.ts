const LOCAL_BACKEND = "http://localhost:8000";

export function getClientApiBase(): string {
  // Browser requests should stay same-origin and flow through the Next.js proxy
  // at /api/v1 so the frontend never has to talk to the backend VM port directly.
  return "";
}

export function getServerApiBase(): string {
  return (
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    LOCAL_BACKEND
  ).replace(/\/$/, "");
}
