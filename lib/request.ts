/**
 * The caller's IP address as reported by the hosting platform.
 * Behind Vercel and similar hosts the platform sets x-forwarded-for itself; on a bare server
 * with no proxy this header could be forged, so run the app behind a proxy in production.
 */
export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const value = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  return value.slice(0, 64);
}

export function userAgentOf(request: Request) {
  return request.headers.get("user-agent")?.slice(0, 300) ?? null;
}
