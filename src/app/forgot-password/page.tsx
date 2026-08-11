"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo }
    );

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-16">
      <div className="card relative w-full max-w-[420px] p-8 shadow-md">
        <div className="mb-6">
          <Link href="/login" className="link-brand inline-flex items-center gap-1.5 text-sm">
            <ArrowLeft className="size-4" aria-hidden />
            Back to sign in
          </Link>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-maroon-dark">
          Reset password
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Enter your admin email and we&apos;ll send a reset link if the account
          exists.
        </p>

        {sent ? (
          <p className="alert alert-success mt-6" role="status">
            If an account exists for that email, a reset link has been sent.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
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
                  required
                  autoComplete="email"
                  className="input-field pl-10"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-[42px] w-full bg-maroon-dark hover:bg-maroon"
            >
              {loading ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
