"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-16">
      <div className="card relative w-full max-w-[420px] p-8 shadow-md">
        <h1 className="text-2xl font-bold tracking-tight text-maroon-dark">
          Choose a new password
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Enter a new password for your AttendEase admin account.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {error && (
            <p className="alert alert-error" role="alert">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="password" className="label-field">
              New password
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-text-muted"
                aria-hidden
              />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="input-field pl-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirm" className="label-field">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="input-field"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-[42px] w-full bg-maroon-dark hover:bg-maroon"
          >
            {loading ? "Updating..." : "Update password"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="link-brand text-sm">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
