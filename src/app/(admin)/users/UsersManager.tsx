"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionEditor } from "@/components/permissions/PermissionEditor";
import type { DepartmentRow, SchoolRow } from "@/lib/data/organization";
import type { PortalUserRow } from "@/lib/data/users";
import {
  ADMIN_ROLE,
  DEPARTMENT_ADMIN_ROLE,
  type PortalRole,
} from "@/lib/constants";
import {
  DEFAULT_DEPARTMENT_ADMIN_PERMISSIONS,
  summarizePermissions,
  type PermissionKey,
} from "@/lib/permissions";
import { displayUserStatus } from "@/lib/format";
import {
  createPortalUser,
  resetPortalUserPassword,
  setUserStatus,
  updatePortalUser,
} from "./actions";
import { KeyRound, Pencil, Plus, UserCheck, UserX } from "lucide-react";

type UsersManagerProps = {
  users: PortalUserRow[];
  schools: SchoolRow[];
  departments: DepartmentRow[];
  currentUserId: string;
};

type WizardStep =
  | "details"
  | "scope"
  | "permissions"
  | "review";

export function UsersManager({
  users,
  schools,
  departments,
  currentUserId,
}: UsersManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [step, setStep] = useState<WizardStep>("details");
  const [selected, setSelected] = useState<PortalUserRow | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<PortalRole>(DEPARTMENT_ADMIN_ROLE);
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const [department, setDepartment] = useState("");
  const [permissions, setPermissions] = useState<PermissionKey[]>([
    ...DEFAULT_DEPARTMENT_ADMIN_PERMISSIONS,
  ]);
  const [sendInvite, setSendInvite] = useState(false);

  const scopedDepartments = useMemo(
    () =>
      departments.filter(
        (d) =>
          d.status !== "archived" &&
          (!schoolId || d.school_id === schoolId)
      ),
    [departments, schoolId]
  );

  function openCreate() {
    setSelected(null);
    setMode("create");
    setStep("details");
    setFullName("");
    setEmail("");
    setRole(DEPARTMENT_ADMIN_ROLE);
    setSchoolId(schools[0]?.id ?? "");
    setDepartment("");
    setPermissions([...DEFAULT_DEPARTMENT_ADMIN_PERMISSIONS]);
    setSendInvite(false);
    setError(null);
    setSuccess(null);
  }

  function openEdit(user: PortalUserRow) {
    setSelected(user);
    setMode("edit");
    setStep("details");
    setFullName(user.full_name);
    setEmail(user.email);
    setRole(user.role === ADMIN_ROLE ? ADMIN_ROLE : DEPARTMENT_ADMIN_ROLE);
    const dept = departments.find((d) => d.code === user.department);
    setSchoolId(dept?.school_id ?? schools[0]?.id ?? "");
    setDepartment(user.department ?? "");
    setPermissions(
      user.role === DEPARTMENT_ADMIN_ROLE
        ? user.permissions
        : [...DEFAULT_DEPARTMENT_ADMIN_PERMISSIONS]
    );
    setError(null);
    setSuccess(null);
  }

  function closeModal() {
    if (isPending) return;
    setMode(null);
    setSelected(null);
  }

  function nextStep() {
    setError(null);
    if (step === "details") {
      if (!fullName.trim() || !email.trim()) {
        setError("Name and email are required.");
        return;
      }
      if (role === ADMIN_ROLE) {
        setStep("review");
        return;
      }
      setStep("scope");
      return;
    }
    if (step === "scope") {
      if (!schoolId || !department) {
        setError("Select a school and department.");
        return;
      }
      setStep("permissions");
      return;
    }
    if (step === "permissions") {
      setStep("review");
    }
  }

  function backStep() {
    setError(null);
    if (step === "review") {
      setStep(role === ADMIN_ROLE ? "details" : "permissions");
      return;
    }
    if (step === "permissions") {
      setStep("scope");
      return;
    }
    if (step === "scope") setStep("details");
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("full_name", fullName);
      formData.set("email", email);
      formData.set("role", role);
      formData.set("department", role === DEPARTMENT_ADMIN_ROLE ? department : "");
      formData.set("school_id", schoolId);
      formData.set("permissions", JSON.stringify(permissions));
      formData.set("send_invite", sendInvite ? "1" : "0");
      if (selected) formData.set("user_id", selected.id);

      const result =
        mode === "edit"
          ? await updatePortalUser(formData)
          : await createPortalUser(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      const tempNote = result.tempPassword
        ? ` Temporary password: ${result.tempPassword}`
        : "";
      setSuccess(
        mode === "edit"
          ? "User updated."
          : `User created.${tempNote}`
      );
      closeModal();
      router.refresh();
    });
  }

  function handleStatus(userId: string, status: "active" | "inactive") {
    setError(null);
    startTransition(async () => {
      const result = await setUserStatus(userId, status);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(status === "active" ? "User reactivated." : "User deactivated.");
      router.refresh();
    });
  }

  function handleReset(user: PortalUserRow) {
    const confirmed = window.confirm(
      `Reset password for ${user.full_name} (${user.email})?\n\nA temporary password will be shown once. Share it securely with the user.`
    );
    if (!confirmed) return;

    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await resetPortalUserPassword(user.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(
        result.tempPassword
          ? `Password reset. Temporary password: ${result.tempPassword}`
          : "Password reset."
      );
    });
  }

  const summary = summarizePermissions(permissions);
  const schoolName = schools.find((s) => s.id === schoolId)?.name ?? "—";
  const deptName =
    departments.find((d) => d.code === department)?.name ??
    department ??
    "—";
  const editingSelf = mode === "edit" && selected?.id === currentUserId;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Users"
        description="Create super admins and configurable department admins"
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus className="size-4" />
            Create user
          </button>
        }
      />

      {(error || success) && (
        <div
          className={
            error
              ? "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              : "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          }
        >
          {error ?? success}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border-subtle bg-surface-raised text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Department</th>
              <th className="px-4 py-3 font-semibold">Access</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border-subtle">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{user.full_name}</p>
                  <p className="text-xs text-text-muted">{user.email}</p>
                </td>
                <td className="px-4 py-3">
                  {user.role === ADMIN_ROLE ? "Super Admin" : "Department Admin"}
                </td>
                <td className="px-4 py-3">{user.department ?? "—"}</td>
                <td className="px-4 py-3">
                  {user.role === ADMIN_ROLE
                    ? "Full system"
                    : `${user.permissions.length} permissions`}
                </td>
                <td className="px-4 py-3">
                  <Badge>{displayUserStatus(user.status)}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="btn-icon"
                      title="Edit"
                      onClick={() => openEdit(user)}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      title="Reset password"
                      aria-label={`Reset password for ${user.full_name}`}
                      disabled={isPending}
                      onClick={() => handleReset(user)}
                    >
                      <KeyRound className="size-4" />
                    </button>
                    {user.status === "active" ? (
                      <button
                        type="button"
                        className="btn-icon"
                        title="Deactivate"
                        onClick={() => handleStatus(user.id, "inactive")}
                      >
                        <UserX className="size-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-icon"
                        title="Reactivate"
                        onClick={() => handleStatus(user.id, "active")}
                      >
                        <UserCheck className="size-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  No portal users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={mode !== null}
        onClose={closeModal}
        title={mode === "edit" ? "Edit user" : "Create user"}
        panelClassName="max-w-3xl"
        footer={
          <>
            {step !== "details" && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={isPending}
                onClick={backStep}
              >
                Back
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              disabled={isPending}
              onClick={closeModal}
            >
              Cancel
            </button>
            {step !== "review" ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={isPending}
                onClick={nextStep}
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={isPending}
                onClick={submit}
              >
                {isPending
                  ? "Saving..."
                  : mode === "edit"
                    ? "Save changes"
                    : "Create user"}
              </button>
            )}
          </>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
          {(["details", "scope", "permissions", "review"] as WizardStep[])
            .filter((s) => role === ADMIN_ROLE ? s === "details" || s === "review" : true)
            .map((s) => (
              <span
                key={s}
                className={
                  s === step
                    ? "rounded-full bg-maroon px-2.5 py-1 text-white"
                    : "rounded-full bg-surface-raised px-2.5 py-1"
                }
              >
                {s}
              </span>
            ))}
        </div>

        {error && mode && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        {step === "details" && (
          <div className="space-y-3">
            {editingSelf && (
              <p className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-secondary">
                You are editing your own super admin account. Email can be
                changed here; role cannot be demoted.
              </p>
            )}
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Full name</span>
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Role</span>
              <select
                className="input"
                value={role}
                disabled={editingSelf}
                onChange={(e) => setRole(e.target.value as PortalRole)}
              >
                <option value={DEPARTMENT_ADMIN_ROLE}>Department Admin</option>
                <option value={ADMIN_ROLE}>Super Admin</option>
              </select>
            </label>
            {mode === "create" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sendInvite}
                  onChange={(e) => setSendInvite(e.target.checked)}
                />
                Send password recovery invite instead of showing temp password
              </label>
            )}
          </div>
        )}

        {step === "scope" && (
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">School</span>
              <select
                className="input"
                value={schoolId}
                onChange={(e) => {
                  setSchoolId(e.target.value);
                  setDepartment("");
                }}
              >
                {schools
                  .filter((s) => s.status === "active")
                  .map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name} ({school.code})
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Department</span>
              <select
                className="input"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">Select department</option>
                {scopedDepartments.map((dept) => (
                  <option key={dept.code} value={dept.code}>
                    {dept.code} — {dept.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {step === "permissions" && (
          <PermissionEditor value={permissions} onChange={setPermissions} />
        )}

        {step === "review" && (
          <div className="space-y-3 rounded-xl border border-border bg-surface-raised p-4 text-sm">
            <p>
              <span className="font-semibold">Name:</span> {fullName}
            </p>
            <p>
              <span className="font-semibold">Email:</span> {email}
            </p>
            <p>
              <span className="font-semibold">Role:</span>{" "}
              {role === ADMIN_ROLE ? "Super Admin" : "Department Admin"}
            </p>
            {role === DEPARTMENT_ADMIN_ROLE && (
              <>
                <p>
                  <span className="font-semibold">School:</span> {schoolName}
                </p>
                <p>
                  <span className="font-semibold">Department:</span> {deptName}
                </p>
                <p>
                  <span className="font-semibold">Permissions:</span>{" "}
                  {summary.total} selected
                  {summary.highRisk > 0
                    ? ` (${summary.highRisk} high-risk)`
                    : ""}
                </p>
              </>
            )}
            {role === ADMIN_ROLE && (
              <p className="text-text-secondary">
                Super admins have full campus access with no department
                restriction.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
