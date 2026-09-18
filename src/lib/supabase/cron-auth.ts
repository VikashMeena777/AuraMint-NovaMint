import { NextResponse } from "next/server";
import { checkCronAuthorization, MIN_SECRET_LENGTH } from "@/lib/actions/safety";

/**
 * Fail-closed authorization guard for cron route handlers.
 *
 * Returns a 401 response when the request is not authorized, or `null` when the
 * request may proceed. A missing / short CRON_SECRET never authorizes a request.
 */
export function assertCronRequest(request: Request): NextResponse | null {
  const header = request.headers.get("authorization");
  const result = checkCronAuthorization(header, process.env.CRON_SECRET);

  if (result.ok) return null;

  if (result.reason === "not_configured") {
    console.error(
      `[Cron] CRON_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters — refusing to run (fail closed).`
    );
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
