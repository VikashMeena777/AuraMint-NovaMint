"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Plate } from "@/components/ui/card";
import { Field, FormBanner } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/input";
import { AUTH_MESSAGES } from "@/lib/validation/auth-messages";

/**
 * Reset password — the second half of the recovery flow.
 *
 * Flow: /login ("Forgot password?") → Supabase emails a link → the link lands on
 * `/auth/callback?next=/reset-password`, which exchanges the code for a recovery
 * session and redirects here → this page sets the new password with
 * `updateUser` and sends the user to the ledger.
 *
 * Failure modes are handled explicitly rather than by a dead end:
 * - no session (expired or already-used link) → explain and link back;
 * - a `?code=` that arrives here directly (some clients strip the intermediate
 *   redirect) → exchange it client-side before giving up.
 */
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const [status, setStatus] = React.useState<"checking" | "ready" | "no-session">("checking");
  const [email, setEmail] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function resolveSession() {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!cancelled) setStatus("no-session");
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;
      if (!session) {
        setStatus("no-session");
        return;
      }
      setEmail(session.user.email ?? null);
      setStatus("ready");
    }

    void resolveSession();
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (password.length < 6) errors.password = AUTH_MESSAGES.passwordMinLength;
    if (password !== confirm) errors.confirm = "The two passwords do not match.";
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    toast.success("Password updated. Welcome back.");
    router.push("/dashboard");
    router.refresh();
  }

  if (status === "checking") {
    return (
      <Plate className="p-5 sm:p-6">
        <p className="label-micro">Recovery</p>
        <h2 className="heading mt-2 text-[28px] leading-tight">Checking your link…</h2>
        <div className="mt-5 flex items-center gap-3 text-[14px] text-[hsl(var(--muted-foreground))]">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Verifying the recovery session.
        </div>
      </Plate>
    );
  }

  if (status === "no-session") {
    return (
      <Plate className="p-5 sm:p-6">
        <p className="label-micro">Recovery</p>
        <h2 className="heading mt-2 text-[28px] leading-tight">This link is no longer valid</h2>
        <FormBanner tone="error" title="Expired or already used" className="mt-5">
          Recovery links are single-use and time-limited. Request a fresh one and open it in the
          same browser you started from.
        </FormBanner>
        <div className="mt-5 flex flex-col gap-2">
          <Button variant="strike" size="lg" className="w-full" asChild>
            <Link href="/login">
              <KeyRound className="size-4" aria-hidden="true" />
              Request a new link
            </Link>
          </Button>
        </div>
      </Plate>
    );
  }

  return (
    <Plate className="p-5 sm:p-6">
      <p className="label-micro">Recovery</p>
      <h2 className="heading mt-2 text-[28px] leading-tight">Set a new password</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
        {email ? (
          <>
            For <span className="mono text-[hsl(var(--foreground))]">{email}</span>. Your ledger,
            streak and tier stay exactly as they are.
          </>
        ) : (
          "Your ledger, streak and tier stay exactly as they are."
        )}
      </p>

      {formError ? (
        <FormBanner tone="error" title="Could not update the password" className="mt-5">
          {formError}
        </FormBanner>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4" noValidate>
        <Field
          label="New password"
          id="reset-password"
          error={fieldErrors.password}
          description="At least 6 characters. A passphrase beats a clever word."
        >
          {(field) => (
            <PasswordInput
              {...field}
              name="new-password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              visible={showPassword}
              onVisibleChange={setShowPassword}
              placeholder="New password"
            />
          )}
        </Field>

        <Field label="Confirm password" id="reset-confirm" error={fieldErrors.confirm}>
          {(field) => (
            <PasswordInput
              {...field}
              name="confirm-password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              visible={showConfirm}
              onVisibleChange={setShowConfirm}
              placeholder="Same password again"
            />
          )}
        </Field>

        <Button type="submit" variant="strike" size="lg" className="w-full" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Updating…
            </>
          ) : (
            "Update password and continue"
          )}
        </Button>
      </form>

      <p className="mt-5 border-t border-[hsl(var(--border))] pt-4 text-[13px] text-[hsl(var(--muted-foreground))]">
        Changed your mind?{" "}
        <Link href="/login" className="font-semibold text-[hsl(var(--primary))] hover:underline">
          Back to sign in
        </Link>
      </p>
    </Plate>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense
      fallback={
        <Plate className="p-5 sm:p-6">
          <div className="h-6 w-24 animate-pulse rounded-[var(--radius-sm)] bg-[hsl(var(--muted))]" />
          <div className="mt-3 h-8 w-56 animate-pulse rounded-[var(--radius-sm)] bg-[hsl(var(--muted))]" />
          <div className="mt-6 h-11 w-full animate-pulse rounded-[var(--radius)] bg-[hsl(var(--muted))]" />
        </Plate>
      }
    >
      <ResetPasswordForm />
    </React.Suspense>
  );
}
