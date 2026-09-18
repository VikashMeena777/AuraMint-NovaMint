"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Plate } from "@/components/ui/card";
import { Field, FormBanner } from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";
import { AUTH_MESSAGES } from "@/lib/validation/auth-messages";

/**
 * Login.
 *
 * Fixes carried in from the audit:
 * - visible labels + `autoComplete` on every control (was placeholder-only);
 * - inline error text wired with `aria-describedby`, not just a toast;
 * - the OAuth callback failure (`/login?error=auth_failed` from
 *   `src/app/auth/callback/route.ts`) is explained on the page;
 * - "Forgot password?" is a real recovery request that emails a link back to
 *   `/auth/callback?next=/reset-password` — it used to be a self-link;
 * - the redirect target is validated against the same rule the server uses
 *   (same-origin absolute path only), so `?redirect=//evil.com` is ignored.
 */

/** Mirrors `safeRedirectPath` (src/lib/actions/safety.ts) for the client side. */
function safeRedirectPath(candidate: string | null): string {
  if (!candidate) return "/dashboard";
  const value = candidate.trim();
  if (value.length === 0 || value.length > 512) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (value.includes("\\")) return "/dashboard";
  if (/^\/[^/]*:/i.test(value)) return "/dashboard";
  return value;
}

const CALLBACK_ERRORS: Record<string, string> = {
  auth_failed:
    "We could not complete that sign-in link. It may have expired, been used already, or been opened in a different browser.",
  link_expired: "That link has expired. Request a new one below.",
  session_expired: "Your session expired. Sign in again to continue.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const errorParam = searchParams.get("error");
  const callbackError = errorParam
    ? CALLBACK_ERRORS[errorParam] ?? CALLBACK_ERRORS.auth_failed
    : null;
  const redirectTo = safeRedirectPath(
    searchParams.get("redirect") ?? searchParams.get("next")
  );
  const prefilledEmail = searchParams.get("email") ?? "";

  const [mode, setMode] = React.useState<"signin" | "recover">("signin");
  const [email, setEmail] = React.useState(prefilledEmail);
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!email.trim()) errors.email = "Enter the email you signed up with.";
    if (!password) errors.password = AUTH_MESSAGES.passwordRequired;
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setPending(false);

    if (error) {
      setFormError(
        error.message.toLowerCase().includes("invalid")
          ? "That email and password combination did not match. Check them and try again."
          : error.message
      );
      return;
    }

    toast.success("Signed in.");
    router.push(redirectTo);
    router.refresh();
  }

  async function handleRecover(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      setFieldErrors({ email: "Enter the email on the account." });
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setPending(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setPending(false);

    if (error) {
      setFormError(error.message);
      return;
    }
    // Never confirm whether an address exists — that is an account oracle.
    setNotice("If that address has an account, a reset link is on its way. Check your inbox.");
  }

  async function handleGoogle() {
    setFormError(null);
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (error) {
      setPending(false);
      setFormError(error.message);
    }
  }

  return (
    <Plate className="p-5 sm:p-6">
      <p className="label-micro">{mode === "signin" ? "Sign in" : "Reset password"}</p>
      <h2 className="heading mt-2 text-[28px] leading-tight">
        {mode === "signin" ? "Welcome back" : "Get a reset link"}
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
        {mode === "signin"
          ? "Your ledger, streak and tier are exactly where you left them."
          : "We will email you a link that lets you set a new password."}
      </p>

      {callbackError ? (
        <FormBanner tone="error" title="Sign-in link problem" className="mt-5">
          {callbackError}
        </FormBanner>
      ) : null}

      {notice ? (
        <FormBanner tone="success" title="Check your email" className="mt-5">
          {notice}
        </FormBanner>
      ) : null}

      {formError ? (
        <FormBanner tone="error" title="Could not sign you in" className="mt-5">
          {formError}
        </FormBanner>
      ) : null}

      <div className="mt-5">
        <Button variant="plate" size="lg" className="w-full" onClick={handleGoogle} disabled={pending}>
          <GoogleMark />
          Continue with Google
        </Button>
      </div>

      <div className="my-5 flex items-center gap-3">
        <span className="aura-divider" />
        <span className="label-micro">or</span>
        <span className="aura-divider" />
      </div>

      {mode === "signin" ? (
        <form onSubmit={handleSignIn} className="flex flex-col gap-4" noValidate>
          <Field label="Email" id="login-email" error={fieldErrors.email}>
            {(field) => (
              <Input
                {...field}
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            )}
          </Field>

          <Field label="Password" id="login-password" error={fieldErrors.password}>
            {(field) => (
              <PasswordInput
                {...field}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                visible={showPassword}
                onVisibleChange={setShowPassword}
                placeholder="Your password"
              />
            )}
          </Field>

          <Button type="submit" variant="strike" size="lg" className="w-full" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="size-4" aria-hidden="true" />
              </>
            )}
          </Button>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setMode("recover");
                setNotice(null);
                setFormError(null);
                setFieldErrors({});
              }}
              className="text-[13px] font-semibold text-[hsl(var(--primary))] underline-offset-4 hover:underline"
            >
              Forgot password?
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleRecover} className="flex flex-col gap-4" noValidate>
          <Field
            label="Email"
            id="recover-email"
            error={fieldErrors.email}
            description="We send a single-use link. It expires for your safety."
          >
            {(field) => (
              <Input
                {...field}
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            )}
          </Field>

          <Button type="submit" variant="strike" size="lg" className="w-full" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : (
              <>
                <Mail className="size-4" aria-hidden="true" />
                Email me a reset link
              </>
            )}
          </Button>

          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setNotice(null);
              setFormError(null);
            }}
            className="self-start text-[13px] font-semibold text-[hsl(var(--primary))] underline-offset-4 hover:underline"
          >
            Back to sign in
          </button>
        </form>
      )}

      <p className="mt-5 border-t border-[hsl(var(--border))] pt-4 text-[13px] text-[hsl(var(--muted-foreground))]">
        No account yet?{" "}
        <Link href="/signup" className="font-semibold text-[hsl(var(--primary))] hover:underline">
          Create one free
        </Link>{" "}
        — five entries a day, no card.
      </p>
    </Plate>
  );
}

function GoogleMark() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function LoginFallback() {
  return (
    <Plate className="p-5 sm:p-6">
      <div className="h-6 w-24 animate-pulse rounded-[var(--radius-sm)] bg-[hsl(var(--muted))]" />
      <div className="mt-3 h-8 w-48 animate-pulse rounded-[var(--radius-sm)] bg-[hsl(var(--muted))]" />
      <div className="mt-6 flex flex-col gap-4">
        <div className="h-11 w-full animate-pulse rounded-[var(--radius)] bg-[hsl(var(--muted))]" />
        <div className="h-11 w-full animate-pulse rounded-[var(--radius)] bg-[hsl(var(--muted))]" />
        <div className="h-12 w-full animate-pulse rounded-[var(--radius)] bg-[hsl(var(--muted))]" />
      </div>
    </Plate>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </React.Suspense>
  );
}
