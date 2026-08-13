"use client";

import { useState, useTransition } from "react";
import { changeOwnPassword } from "./actions";

export function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set("current_password", currentPassword);
    formData.set("new_password", newPassword);
    formData.set("confirm_password", confirmPassword);

    startTransition(async () => {
      const result = await changeOwnPassword(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Change password
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Enter your current password, then choose a new one.
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
        <label htmlFor="current_password" className="label-field">
          Current password
        </label>
        <input
          id="current_password"
          name="current_password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="input-field"
          disabled={isPending}
        />
      </div>

      <div>
        <label htmlFor="new_password" className="label-field">
          New password
        </label>
        <input
          id="new_password"
          name="new_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="input-field"
          disabled={isPending}
        />
        <p className="mt-1 text-xs text-text-muted">
          At least 8 characters.
        </p>
      </div>

      <div>
        <label htmlFor="confirm_password" className="label-field">
          Confirm new password
        </label>
        <input
          id="confirm_password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="input-field"
          disabled={isPending}
        />
      </div>

      <div className="pt-1">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isPending}
        >
          {isPending ? "Updating..." : "Update password"}
        </button>
      </div>
    </form>
  );
}
