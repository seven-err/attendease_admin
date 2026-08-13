"use client";

import { Badge } from "@/components/ui/Badge";
import { CheckerProfileRow, CheckerRow } from "@/lib/attendeaseTypes";
import {
  CHECKER_DEPARTMENTS,
  EMPLOYEE_LABEL,
  SSG_LABEL,
} from "@/lib/constants";
import { displayUserStatus } from "@/lib/format";
import { Hash, Undo2 } from "lucide-react";

const inputClass =
  "h-10 w-full rounded border border-border px-3 text-sm outline-none focus:border-maroon";

type CheckerFormProps = {
  formId: string;
  checker?: CheckerRow | null;
  canEditEmail?: boolean;
  /** When true, account fields are read-only (view profiles / details). */
  readOnly?: boolean;
  onSubmit?: (formData: FormData) => void;
  allowedDepartments?: readonly string[];
  lockedDepartment?: string | null;
  canPinManage?: boolean;
  pinActionsPending?: boolean;
  onResetProfilePin?: (profile: CheckerProfileRow) => void;
  onRestoreProfilePin?: (profile: CheckerProfileRow) => void;
};

function checkerDepartmentValue(checker?: CheckerRow | null): string {
  if (!checker) return "";
  if (checker.checker_scope === "ssg") return SSG_LABEL;
  if (checker.checker_scope === "employee") return EMPLOYEE_LABEL;
  return checker.department ?? "";
}

function profileRoleLabel(role: CheckerProfileRow["profile_role"]): string {
  return role === "moderator" ? "Moderator" : "Checker";
}

function CheckerProfilesList({
  profiles,
  canPinManage = false,
  pinActionsPending = false,
  onResetProfilePin,
  onRestoreProfilePin,
}: {
  profiles: CheckerProfileRow[];
  canPinManage?: boolean;
  pinActionsPending?: boolean;
  onResetProfilePin?: (profile: CheckerProfileRow) => void;
  onRestoreProfilePin?: (profile: CheckerProfileRow) => void;
}) {
  if (!profiles.length) {
    return (
      <p className="rounded border border-dashed border-border bg-header-bg px-3 py-3 text-sm text-text-secondary">
        No device profiles on this account yet. Profiles (moderator and
        checkers) appear here once created on the mobile app.
      </p>
    );
  }

  const moderatorCount = profiles.filter(
    (p) => p.profile_role === "moderator"
  ).length;
  const checkerCount = profiles.length - moderatorCount;

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-muted">
        {profiles.length} profile{profiles.length === 1 ? "" : "s"}
        {moderatorCount > 0 || checkerCount > 0
          ? ` · ${moderatorCount} moderator${moderatorCount === 1 ? "" : "s"}, ${checkerCount} checker${checkerCount === 1 ? "" : "s"}`
          : ""}
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded border border-border">
        {profiles.map((profile) => (
          <li
            key={profile.id}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-bold">{profile.display_name}</p>
              <p className="text-xs text-text-muted">
                {profile.setup_completed ? "PIN set up" : "Setup pending"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <Badge
                className={
                  profile.profile_role === "moderator"
                    ? "border border-maroon bg-transparent text-maroon"
                    : undefined
                }
              >
                {profileRoleLabel(profile.profile_role)}
              </Badge>
              <Badge
                variant={profile.status === "active" ? "active" : "inactive"}
              >
                {displayUserStatus(profile.status)}
              </Badge>
              {canPinManage && onResetProfilePin && (
                <button
                  type="button"
                  onClick={() => onResetProfilePin(profile)}
                  disabled={pinActionsPending}
                  className="rounded p-1 hover:bg-gray-100 disabled:opacity-60"
                  aria-label={`Reset PIN for ${profile.display_name}`}
                  title="Reset this profile's PIN"
                >
                  <Hash className="size-4" />
                </button>
              )}
              {canPinManage &&
                profile.canRestorePreviousPin &&
                onRestoreProfilePin && (
                  <button
                    type="button"
                    onClick={() => onRestoreProfilePin(profile)}
                    disabled={pinActionsPending}
                    className="rounded p-1 hover:bg-gray-100 disabled:opacity-60"
                    aria-label={`Restore previous PIN for ${profile.display_name}`}
                    title="Restore previous PIN"
                  >
                    <Undo2 className="size-4" />
                  </button>
                )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CheckerForm({
  formId,
  checker,
  canEditEmail = false,
  readOnly = false,
  onSubmit,
  allowedDepartments,
  lockedDepartment = null,
  canPinManage = false,
  pinActionsPending = false,
  onResetProfilePin,
  onRestoreProfilePin,
}: CheckerFormProps) {
  const scopeOptions = lockedDepartment
    ? [lockedDepartment]
    : allowedDepartments?.length
      ? [...allowedDepartments]
      : [...CHECKER_DEPARTMENTS];

  const defaults = {
    full_name: checker?.full_name ?? "",
    email: checker?.email ?? "",
    department:
      lockedDepartment ||
      checkerDepartmentValue(checker) ||
      (scopeOptions.length === 1 ? scopeOptions[0] : ""),
  };

  const emailEditable = !readOnly && (!checker || canEditEmail);
  const fieldsLocked = readOnly || Boolean(lockedDepartment);
  const profiles = checker?.profiles ?? [];

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        if (readOnly || !onSubmit) return;
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-bold">Full Name</label>
          <input
            name="full_name"
            defaultValue={defaults.full_name}
            placeholder="e.g. Andres Bonifacio"
            required={!readOnly}
            readOnly={readOnly}
            className={`${inputClass}${readOnly ? " bg-header-bg text-text-secondary" : ""}`}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold">Email</label>
          <input
            name="email"
            type="email"
            defaultValue={defaults.email}
            placeholder="name@attendease.edu"
            required={!readOnly}
            readOnly={!emailEditable}
            className={`${inputClass}${emailEditable ? "" : " bg-header-bg text-text-secondary"}`}
          />
          {checker && canEditEmail && !readOnly && (
            <p className="mt-1 text-xs text-text-muted">
              Changing email updates the checker&apos;s login address
              immediately.
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-bold">Scope</label>
        <select
          name="department"
          defaultValue={defaults.department}
          required={!readOnly}
          disabled={fieldsLocked}
          className={`${inputClass}${fieldsLocked ? " bg-header-bg text-text-secondary" : ""}`}
        >
          {!lockedDepartment && !readOnly && (
            <option value="">Select scope</option>
          )}
          {scopeOptions.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>
        {lockedDepartment && !readOnly && (
          <input type="hidden" name="department" value={lockedDepartment} />
        )}
        {!readOnly && (
          <p className="mt-1 text-xs text-text-muted">
            {lockedDepartment
              ? `Checkers for this account are limited to ${lockedDepartment}.`
              : "SSG covers all student departments. Employee covers CRMC staff attendance."}
          </p>
        )}
      </div>

      {checker && (
        <div>
          <label className="mb-1 block text-sm font-bold">
            Profiles on this account
          </label>
          <p className="mb-2 text-xs text-text-muted">
            Includes moderator and checker profiles linked to this login.
            {canPinManage
              ? " Reset PIN for one profile at a time with the # button."
              : ""}
          </p>
          <CheckerProfilesList
            profiles={profiles}
            canPinManage={canPinManage}
            pinActionsPending={pinActionsPending}
            onResetProfilePin={onResetProfilePin}
            onRestoreProfilePin={onRestoreProfilePin}
          />
        </div>
      )}
    </form>
  );
}
