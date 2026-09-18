import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Proxy (formerly `middleware`) — Next.js 16 renamed the file convention
 * (`middleware.ts` is deprecated) and the exported function must be `proxy`.
 * See node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.
 *
 * This is only an *optimistic* auth gate: every Server Action and Route Handler
 * re-verifies the session, because proxy redirects can be bypassed by calling
 * endpoints directly.
 */
export async function proxy(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch (err) {
    // A Supabase outage must not 500 every route (including payment webhooks and
    // cron). Fail open *for rendering* — the (app) layout still enforces auth.
    console.error("[Proxy] Session refresh failed:", err);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/cron (authenticated by CRON_SECRET inside the handler)
     * - api/webhooks (third-party deliveries must not depend on session refresh)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!api/cron|api/webhooks|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
