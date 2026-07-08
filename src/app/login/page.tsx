"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ADMIN_ROLE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Eye, EyeOff, GraduationCap, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      setError("Login failed. Please try again.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role, status")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setError("Unable to load your profile. Contact an administrator.");
      setLoading(false);
      return;
    }

    if (profile.role !== ADMIN_ROLE || profile.status !== "active") {
      await supabase.auth.signOut();
      setError("Access denied. Admin credentials required.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-16">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--maroon-light)_0%,_transparent_50%)] opacity-60"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-maroon/5 blur-3xl"
        aria-hidden
      />

      <div className="card relative w-full max-w-[420px] p-8 shadow-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-maroon shadow-sm">
            <GraduationCap className="size-7 text-white" aria-hidden />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-maroon-dark">
            AttendEase
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary">Admin Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="alert alert-error" role="alert">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="email" className="label-field">
              Email Address
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-text-muted"
                aria-hidden
              />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@institution.edu"
                required
                autoComplete="email"
                className="input-field pl-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="label-field">
              Password
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-text-muted"
                aria-hidden
              />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="input-field px-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="btn-icon absolute right-1 top-1/2 -translate-y-1/2"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-[18px]" />
                ) : (
                  <Eye className="size-[18px]" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="mt-1 h-[42px] w-full bg-maroon-dark hover:bg-maroon"
          >
            {loading ? "Signing in..." : "Sign in"}
            {!loading && <ArrowRight className="size-[18px]" aria-hidden />}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link href="#" className="link-brand text-sm">
            Forgot password?
          </Link>
        </div>

        <div className="mt-6 border-t border-border-subtle pt-4 text-center">
          <p className="text-xs leading-relaxed text-text-muted">
            Secure institutional access only. Activity is monitored.
          </p>
        </div>
      </div>
    </div>
  );
}
