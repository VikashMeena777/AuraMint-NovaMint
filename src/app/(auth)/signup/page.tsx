"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles, User, Crown } from "lucide-react";
import { toast } from "sonner";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    const cleanUsername = username.trim().toLowerCase();
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(cleanUsername)) {
      toast.error("Username must be 3-20 characters, only letters, numbers, and underscores");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);

    // Uniqueness check for username
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (existing) {
      toast.error("Username already taken");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: cleanUsername,
          full_name: fullName.trim(),
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created! Check your email to verify ✉️");
    router.push("/login");
  }

  async function handleGoogleSignup() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className="glass-card relative mx-auto w-full max-w-sm p-8 shadow-2xl overflow-hidden animate-fade-up" style={{ animationDelay: "0.15s" }}>
      <div className="grain-overlay" />
      <div className="relative z-10">
        {/* Brand Logo */}
        <div className="flex justify-center mb-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/15">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <span className="heading text-xl tracking-tighter grad-gold">AuraMint</span>
          </Link>
        </div>

        {/* Heading */}
        <div className="mb-4 text-center">
          <h2 className="heading text-xl tracking-tight leading-none">Start Your Aura Journey</h2>
          <p className="mt-2 text-xs text-muted-foreground">Create your account and discover your vibe</p>
        </div>

        {/* Feature Tag */}
        <div className="mb-5 flex justify-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/[0.08] border border-primary/20 px-4 py-1.5 text-[10px] font-bold text-primary tracking-wider uppercase">
            <Sparkles className="h-3 w-3" />
            Free forever · No credit card
          </div>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleSignup} className="space-y-3.5">
          {/* Full Name */}
          <div className="relative">
            <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <input
              id="signup-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full Name"
              required
              className="w-full aura-input rounded-xl py-3.5 pl-11 pr-4 text-sm"
            />
          </div>

          {/* Username */}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 mono text-xs font-bold text-muted-foreground/50">@</span>
            <input
              id="signup-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20))}
              placeholder="username"
              required
              minLength={3}
              maxLength={20}
              className="w-full aura-input rounded-xl py-3.5 pl-9 pr-4 text-sm font-semibold"
            />
          </div>

          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="w-full aura-input rounded-xl py-3.5 pl-11 pr-4 text-sm"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 chars)"
              required
              minLength={6}
              className="w-full aura-input rounded-xl py-3.5 pl-11 pr-11 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground transition hover:brightness-110 glow-brand disabled:opacity-50 active:scale-95"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/20 border-t-primary-foreground" />
            ) : (
              <>
                Create Account
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="aura-divider" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">or</span>
          <div className="aura-divider" />
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogleSignup}
          className="flex w-full items-center justify-center gap-3 aura-btn-secondary py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Sign up with Google
        </button>

        {/* Login link */}
        <p className="mt-6 text-center text-[11px] font-medium text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-accent hover:underline transition">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
