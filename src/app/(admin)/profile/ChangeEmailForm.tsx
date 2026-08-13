"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeOwnEmail } from "./actions";

type ChangeEmailFormProps = {
  currentEmail: string;
};

export function ChangeEmailForm({ currentEmail }: ChangeEmailFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set("new_email", newEmail);
    formData.set("current_password", currentPassword);

    startTransition(async () => {
      const result = await changeOwnEmail(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess("Email updated. Use the new address the next time you sign in.");
      setNewEmail("");
      setCurrentPassword("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Change email
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Update the login email for your super admin account. Current:{" "}
          <span className="font-medium text-foreground">{currentEmail}</span>
        </p>
      </div>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="alert alert-success" role="status">
          {success}
        </p>
      )}

      <div>
        <label htmlFor="new_email" className="label-field">
          New email
        </label>
        <input
          id="new_email"
          name="new_email"
          type="email"
          autoComplete="email"
          required
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="input-field"
          disabled={isPending}
        />
      </div>

      <div>
        <label htmlFor="email_current_password" className="label-field">
          Current password
        </label>
        <input
          id="email_current_password"
          name="current_password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="input-field"
          disabled={isPending}
        />
        <p className="mt-1 text-xs text-text-muted">
          Required to confirm this change.
        </p>
      </div>

      <div className="pt-1">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isPending}
        >
          {isPending ? "Updating..." : "Update email"}
        </button>
      </div>
    </form>
  );
}
