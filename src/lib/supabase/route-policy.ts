/**
 * Route protection policy used by the proxy (`src/proxy.ts`).
 *
 * Pure and dependency-free so the policy itself is regression-tested — the proxy is
 * only an optimistic gate, but an incomplete list still leaks redirect UX.
 */

/** Prefixes of the authenticated application area (the `(app)` route group). */
export const PROTECTED_PATHS = [
  "/dashboard",
  "/analytics",
  "/badges",
  "/leaderboard",
  "/onboarding",
  "/premium",
  "/profile",
  "/settings",
  "/vs",
  "/wrapped",
] as const;

/** Signed-in users are bounced away from these. */
export const AUTH_PATHS = ["/login", "/signup"] as const;

/** Segment-exact prefix match: `/dashboard` matches `/dashboard/x`, not `/dashboardx`. */
export function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  if (typeof pathname !== "string") return false;
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isProtectedPath(pathname: string): boolean {
  return matchesPrefix(pathname, PROTECTED_PATHS);
}

export function isAuthPath(pathname: string): boolean {
  return matchesPrefix(pathname, AUTH_PATHS);
}
