"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { toast } from "sonner";

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back! 👑");
    router.push(redirect);
    router.refresh();
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}`,
      },
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className="glass noise relative mx-auto w-full max-w-sm p-8 shadow-2xl border border-border/40">
      <div className="relative z-10">
        {/* Header Title */}
        <div className="mb-6 text-center">
          <h2 className="heading text-xl tracking-tight leading-none">Welcome Back</h2>
          <p className="mt-1 text-xs text-muted-foreground">Sign in to check your aura status</p>
        </div>

        {/* Google OAuth Button */}
        <button
          onClick={handleGoogleLogin}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border/80 bg-secondary/30 py-3.5 text-xs font-bold uppercase tracking-wider transition hover:bg-secondary/60 hover:border-primary/20 shadow-sm"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
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
          Google
        </button>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border/40" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">or</span>
          <div className="h-px flex-1 bg-border/40" />
        </div>

        {/* standard Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="w-full rounded-2xl border border-border/80 bg-secondary/15 py-3.5 pl-11 pr-4 text-xs transition placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-secondary/35 focus:outline-none"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full rounded-2xl border border-border/80 bg-secondary/15 py-3.5 pl-11 pr-11 text-xs transition placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-secondary/35 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-xs font-extrabold uppercase tracking-wider text-primary-foreground transition hover:brightness-110 shadow-md glow-brand disabled:opacity-50"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/20 border-t-primary-foreground" />
            ) : (
              <>
                Log In
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer sign up redirection link */}
        <p className="mt-6 text-center text-[11px] font-medium text-muted-foreground/80">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-bold text-primary hover:underline transition">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="glass noise relative mx-auto w-full max-w-sm p-8 animate-pulse border border-border/40">
          <div className="h-6 w-32 rounded bg-muted/65 mx-auto mb-6" />
          <div className="h-12 w-full rounded-2xl bg-muted/50 mb-4" />
          <div className="h-1 w-full rounded bg-muted/20 mb-4" />
          <div className="h-12 w-full rounded-2xl bg-muted/30 mb-3" />
          <div className="h-12 w-full rounded-2xl bg-muted/30 mb-4" />
          <div className="h-12 w-full rounded-2xl bg-muted" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
