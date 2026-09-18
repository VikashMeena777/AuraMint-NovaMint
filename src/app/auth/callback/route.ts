import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email/send";
import { resolveTrustedOrigin, safeRedirectPath } from "@/lib/actions/safety";

/**
 * OAuth / magic-link callback.
 *
 * Security notes:
 * - `next` is validated to a same-origin relative path (no open redirect).
 * - `x-forwarded-host` is deliberately ignored: it is attacker-controllable unless a
 *   trusted proxy always overwrites it. The origin comes from NEXT_PUBLIC_APP_URL,
 *   falling back to the request's own origin.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Welcome mail only for freshly created accounts, so repeat logins don't spam. */
const WELCOME_EMAIL_MAX_ACCOUNT_AGE_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = safeRedirectPath(url.searchParams.get("next"));
  const origin = resolveTrustedOrigin(process.env.NEXT_PUBLIC_APP_URL, url.origin);
  const failureUrl = new URL("/login?error=auth_failed", origin);

  if (typeof code !== "string" || code.length < 8 || code.length > 512) {
    return NextResponse.redirect(failureUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Never log the code itself — only the provider error.
    console.error("[AuthCallback] Code exchange failed:", error.message);
    return NextResponse.redirect(failureUrl);
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.email) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, onboarding_complete")
        .eq("id", user.id)
        .maybeSingle();

      const profileRow = profile as { username?: string | null; onboarding_complete?: boolean | null } | null;
      const accountCreatedAt = user.created_at ? new Date(user.created_at).getTime() : NaN;
      const accountAgeMs = Number.isFinite(accountCreatedAt) ? Date.now() - accountCreatedAt : Number.POSITIVE_INFINITY;
      const isNewUser = !profileRow?.onboarding_complete && accountAgeMs < WELCOME_EMAIL_MAX_ACCOUNT_AGE_MS;

      if (isNewUser) {
        const email = user.email;
        const username = profileRow?.username || "AuraMinter";

        // Run after the redirect response is sent, so the email is not lost when the
        // serverless invocation ends (a bare floating promise can be killed).
        after(async () => {
          await sendWelcomeEmail(email, username);
        });
      }
    }
  } catch (err) {
    // Onboarding email must never block a successful sign-in.
    console.error("[AuthCallback] Welcome email step failed:", err);
  }

  return NextResponse.redirect(new URL(nextPath, origin));
}
