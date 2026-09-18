"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Plate } from "@/components/ui/card";
import { Field, FormBanner } from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";
import { AUTH_MESSAGES } from "@/lib/validation/auth-messages";

/**
 * Signup.
 *
 * Fixes carried in from the audit:
 * - visible labels + `autoComplete="new-password"` and `inputMode` hints;
 * - per-field inline errors instead of toast-only validation;
 * - the username uniqueness check is advisory: the database constraint is the
 *   source of truth, and a race surfaces as a friendly inline message;
 * - a successful signup ends on a "verify your email" state with a resend
 *   action (previously it announced "check your email" and silently pushed the
 *   visitor back to /login, losing the instruction).
 */
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export default function SignupPage() {
  const [fullName, setFullName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [needsVerification, setNeedsVerification] = React.useState(false);
  const [resent, setResent] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanUsername = username.trim().toLowerCase();
    const errors: Record<string, string> = {};
    if (fullName.trim().length < 2) errors.fullName = "Tell us what to call you.";
    if (!USERNAME_PATTERN.test(cleanUsername)) {
      errors.username = "3–20 characters: letters, numbers and underscores only.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      errors.email = "That does not look like an email address.";
    }
    if (password.length < 6) errors.password = AUTH_MESSAGES.passwordMinLength;

    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    const supabase = createClient();

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (existing) {
      setPending(false);
      setFieldErrors({ username: "That username is already taken. Try another." });
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username: cleanUsername, full_name: fullName.trim() },
      },
    });
    setPending(false);

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("already registered") || message.includes("already exists")) {
        setFieldErrors({ email: "An account already uses this email. Try signing in instead." });
        return;
      }
      if (message.includes("username") || message.includes("duplicate key")) {
        setFieldErrors({ username: "That username was just taken. Pick another." });
        return;
      }
      setFormError(error.message);
      return;
    }

    setNeedsVerification(true);
    toast.success("Account created.");
  }

  async function handleGoogle() {
    setFormError(null);
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setPending(false);
      setFormError(error.message);
    }
  }

  async function handleResend() {
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
    setPending(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    setResent(true);
  }

  if (needsVerification) {
    return (
      <Plate className="p-5 sm:p-6">
        <p className="label-micro">Almost there</p>
        <h2 className="heading mt-2 text-[28px] leading-tight">Verify your email</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          We sent a confirmation link to{" "}
          <span className="mono text-[hsl(var(--foreground))]">{email.trim()}</span>. Open it to
          activate the account, then sign in and log your first moment.
        </p>

        {resent ? (
          <FormBanner tone="success" title="Link resent" className="mt-5">
            Give it a minute — check spam if it has not arrived.
          </FormBanner>
        ) : null}

        {formError ? (
          <FormBanner tone="error" title="Could not resend" className="mt-5">
            {formError}
          </FormBanner>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          <Button variant="strike" size="lg" className="w-full" asChild>
            <Link href={`/login?email=${encodeURIComponent(email.trim())}`}>
              <MailCheck className="size-4" aria-hidden="true" />
              Go to sign in
            </Link>
          </Button>
          <Button
            variant="plate"
            size="lg"
            className="w-full"
            onClick={handleResend}
            disabled={pending}
          >
            {pending ? "Sending…" : "Resend the confirmation email"}
          </Button>
        </div>
      </Plate>
    );
  }

  return (
    <Plate className="p-5 sm:p-6">
      <p className="label-micro">Create account</p>
      <h2 className="heading mt-2 text-[28px] leading-tight">Open your ledger</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
        Free plan: five entries a day, the full ladder and the public leaderboard. No card.
      </p>

      {formError ? (
        <FormBanner tone="error" title="Could not create the account" className="mt-5">
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Name" id="signup-name" error={fieldErrors.fullName}>
          {(field) => (
            <Input
              {...field}
              name="name"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Your name"
            />
          )}
        </Field>

        <Field
          label="Username"
          id="signup-username"
          error={fieldErrors.username}
          description="Lowercase letters, numbers and underscores. This is your public handle."
        >
          {(field) => (
            <div className="relative">
              <span
                aria-hidden="true"
                className="mono pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[hsl(var(--muted-foreground))]"
              >
                @
              </span>
              <Input
                {...field}
                name="username"
                autoComplete="username"
                className="pl-7"
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20))
                }
                placeholder="auraminter"
              />
            </div>
          )}
        </Field>

        <Field label="Email" id="signup-email" error={fieldErrors.email}>
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

        <Field
          label="Password"
          id="signup-password"
          error={fieldErrors.password}
          description="At least 6 characters."
        >
          {(field) => (
            <PasswordInput
              {...field}
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              visible={showPassword}
              onVisibleChange={setShowPassword}
              placeholder="Something you will remember"
            />
          )}
        </Field>

        <Button type="submit" variant="strike" size="lg" className="w-full" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Creating your account…
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-5 border-t border-[hsl(var(--border))] pt-4 text-[13px] text-[hsl(var(--muted-foreground))]">
        Already minting?{" "}
        <Link href="/login" className="font-semibold text-[hsl(var(--primary))] hover:underline">
          Sign in
        </Link>
        .
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
