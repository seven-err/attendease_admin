"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { CheckerProfileRow, CheckerRow } from "@/lib/attendeaseTypes";
import { DEPARTMENTS, EMPLOYEE_LABEL, SSG_LABEL } from "@/lib/constants";
import { useListParams } from "@/lib/hooks/useListParams";
import type { PageSize } from "@/lib/pagination";
import { displayUserStatus } from "@/lib/format";
import {
  Ban,
  Check,
  Eye,
  Hash,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Trash2,
  Undo2,
} from "lucide-react";
import { CheckerForm } from "./CheckerForm";
import {
  createChecker,
  deleteChecker,
  resetCheckerPassword,
  resetCheckerPins,
  resetCheckerProfilePin,
  restoreCheckerPins,
  restoreCheckerProfilePin,
  toggleCheckerActive,
  updateChecker,
} from "./actions";

type CheckersTableProps = {
  checkers: CheckerRow[];
  page: number;
  pageSize: PageSize;
  total: number;
  totalPages: number;
  search: string;
  department: string;
  isSuperAdmin: boolean;
  canManage: boolean;
  canPinManage: boolean;
  scopedDepartment?: string | null;
};

type ConfirmDialog =
  | { kind: "delete"; checker: CheckerRow }
  | { kind: "reset_password"; checker: CheckerRow }
  | { kind: "reset_all_pins"; checker: CheckerRow }
  | { kind: "reset_profile_pin"; profile: CheckerProfileRow }
  | {
      kind: "restore_all_pins";
      checkerId: string;
      checkerName: string;
    }
  | {
      kind: "restore_profile_pin";
      profileId: string;
      displayName: string;
    };

function profileSummary(checker: CheckerRow): string {
  const profiles = checker.profiles ?? [];
  if (!profiles.length) return "—";
  const mods = profiles.filter((p) => p.profile_role === "moderator").length;
  const checkers = profiles.length - mods;
  const parts: string[] = [];
  if (mods) parts.push(`${mods} mod`);
  if (checkers) parts.push(`${checkers} checker${checkers === 1 ? "" : "s"}`);
  return parts.join(" · ") || String(profiles.length);
}

export function CheckersTable({
  checkers,
  page,
  pageSize,
  total,
  totalPages,
  search,
  department,
  isSuperAdmin,
  canManage,
  canPinManage,
  scopedDepartment = null,
}: CheckersTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { searchInput, setSearchInput, setPage, setPageSize, updateParams } =
    useListParams(search);

  const [modalMode, setModalMode] = useState<"add" | "edit" | "view" | null>(
    null
  );
  const [selectedChecker, setSelectedChecker] = useState<CheckerRow | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [undoPinCheckerId, setUndoPinCheckerId] = useState<string | null>(null);
  const [undoPinCheckerName, setUndoPinCheckerName] = useState<string | null>(
    null
  );
  const [undoPinProfileId, setUndoPinProfileId] = useState<string | null>(null);
  const [undoPinProfileName, setUndoPinProfileName] = useState<string | null>(
    null
  );
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(
    null
  );

  // Keep the open modal's checker/profiles in sync after PIN reset refresh.
  useEffect(() => {
    if (!selectedChecker) return;
    const fresh = checkers.find((c) => c.id === selectedChecker.id);
    if (fresh) setSelectedChecker(fresh);
  }, [checkers, selectedChecker?.id]);

  const effectiveDepartment = scopedDepartment ?? department;
  const deptOptions = scopedDepartment
    ? [scopedDepartment]
    : [...DEPARTMENTS];

  function openAddModal() {
    setSelectedChecker(null);
    setError(null);
    setSuccess(null);
    setModalMode("add");
  }

  function openViewModal(checker: CheckerRow) {
    setSelectedChecker(checker);
    setError(null);
    setSuccess(null);
    setModalMode("view");
  }

  function openEditModal(checker: CheckerRow) {
    setSelectedChecker(checker);
    setError(null);
    setSuccess(null);
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedChecker(null);
    setError(null);
  }

  function handleDepartmentChange(value: string) {
    updateParams({
      dept: value === "all" ? undefined : value,
      page: "1",
    });
  }

  function handleToggleStatus(checkerId: string) {
    setError(null);
    startTransition(async () => {
      const result = await toggleCheckerActive(checkerId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete(checker: CheckerRow) {
    setConfirmDialog({ kind: "delete", checker });
  }

  function clearUndoPinState() {
    setUndoPinCheckerId(null);
    setUndoPinCheckerName(null);
    setUndoPinProfileId(null);
    setUndoPinProfileName(null);
  }

  function handleResetPassword(checker: CheckerRow) {
    setConfirmDialog({ kind: "reset_password", checker });
  }

  function handleResetPins(checker: CheckerRow) {
    setConfirmDialog({ kind: "reset_all_pins", checker });
  }

  function handleResetProfilePin(profile: CheckerProfileRow) {
    setConfirmDialog({ kind: "reset_profile_pin", profile });
  }

  function handleRestorePins(checkerId: string, checkerName?: string) {
    setConfirmDialog({
      kind: "restore_all_pins",
      checkerId,
      checkerName: checkerName ?? "this checker",
    });
  }

  function handleRestoreProfilePin(
    profile: CheckerProfileRow | { id: string; display_name: string }
  ) {
    setConfirmDialog({
      kind: "restore_profile_pin",
      profileId: profile.id,
      displayName: profile.display_name,
    });
  }

  function closeConfirmDialog() {
    if (isPending) return;
    setConfirmDialog(null);
  }

  function executeConfirm() {
    if (!confirmDialog) return;
    const dialog = confirmDialog;
    setError(null);

    startTransition(async () => {
      if (dialog.kind === "delete") {
        const result = await deleteChecker(dialog.checker.id);
        if (!result.success) {
          setError(result.error);
          setConfirmDialog(null);
          return;
        }
        setSuccess("Checker deleted permanently.");
        setConfirmDialog(null);
        router.refresh();
        closeModal();
        return;
      }

      if (dialog.kind === "reset_password") {
        const result = await resetCheckerPassword(dialog.checker.id);
        if (!result.success) {
          setError(result.error);
          setConfirmDialog(null);
          return;
        }
        setSuccess(
          result.tempPassword
            ? `Password reset. Temporary password: ${result.tempPassword}`
            : "Password reset."
        );
        setConfirmDialog(null);
        return;
      }

      if (dialog.kind === "reset_all_pins") {
        const result = await resetCheckerPins(dialog.checker.id);
        if (!result.success) {
          setError(result.error);
          setConfirmDialog(null);
          return;
        }
        const count = result.profilesReset ?? 0;
        setSuccess(
          result.tempPin
            ? `PIN reset for ${count} profile${count === 1 ? "" : "s"}. Temporary PIN: ${result.tempPin}`
            : "PIN reset."
        );
        if (result.canUndoPin) {
          setUndoPinCheckerId(dialog.checker.id);
          setUndoPinCheckerName(dialog.checker.full_name);
          setUndoPinProfileId(null);
          setUndoPinProfileName(null);
        } else {
          clearUndoPinState();
        }
        setConfirmDialog(null);
        router.refresh();
        return;
      }

      if (dialog.kind === "reset_profile_pin") {
        const result = await resetCheckerProfilePin(dialog.profile.id);
        if (!result.success) {
          setError(result.error);
          setConfirmDialog(null);
          return;
        }
        const label =
          result.profileDisplayName ?? dialog.profile.display_name;
        setSuccess(
          result.tempPin
            ? `PIN reset for ${label}. Temporary PIN: ${result.tempPin}`
            : `PIN reset for ${label}.`
        );
        if (result.canUndoPin && result.profileId) {
          setUndoPinProfileId(result.profileId);
          setUndoPinProfileName(label);
          setUndoPinCheckerId(result.checkerId ?? null);
          setUndoPinCheckerName(null);
        } else {
          clearUndoPinState();
        }
        setConfirmDialog(null);
        router.refresh();
        return;
      }

      if (dialog.kind === "restore_all_pins") {
        const result = await restoreCheckerPins(dialog.checkerId);
        if (!result.success) {
          setError(result.error);
          setConfirmDialog(null);
          return;
        }
        const count = result.profilesRestored ?? 0;
        setSuccess(
          `Previous PIN restored for ${count} profile${count === 1 ? "" : "s"}.`
        );
        clearUndoPinState();
        setConfirmDialog(null);
        router.refresh();
        return;
      }

      const result = await restoreCheckerProfilePin(dialog.profileId);
      if (!result.success) {
        setError(result.error);
        setConfirmDialog(null);
        return;
      }
      const label = result.profileDisplayName ?? dialog.displayName;
      setSuccess(`Previous PIN restored for ${label}.`);
      clearUndoPinState();
      setConfirmDialog(null);
      router.refresh();
    });
  }

  function handleSave(formData: FormData) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result =
        modalMode === "edit" && selectedChecker
          ? await updateChecker(selectedChecker.id, formData)
          : await createChecker(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      closeModal();
      router.refresh();

      setSuccess(
        modalMode === "edit"
          ? "Checker updated successfully."
          : `Checker created successfully. Temporary password: ${
              result.tempPassword ?? "(not available)"
            }`
      );
    });
  }

  const formId = "checker-form";
  const isEdit = modalMode === "edit" && selectedChecker;
  const isView = modalMode === "view" && selectedChecker;
  const isAdd = modalMode === "add";

  const confirmCopy = (() => {
    if (!confirmDialog) return null;
    switch (confirmDialog.kind) {
      case "delete":
        return {
          title: "Delete checker?",
          confirmLabel: isPending ? "Deleting..." : "Yes, delete",
          danger: true,
          body: (
            <p className="text-sm text-text-secondary">
              Permanently delete{" "}
              <span className="font-bold text-foreground">
                {confirmDialog.checker.full_name}
              </span>{" "}
              ({confirmDialog.checker.email})? This removes their login and
              checker profiles. Attendance history is kept.
            </p>
          ),
        };
      case "reset_password":
        return {
          title: "Reset password?",
          confirmLabel: isPending ? "Resetting..." : "Yes, reset password",
          danger: false,
          body: (
            <div className="space-y-2 text-sm text-text-secondary">
              <p>
                Reset password for{" "}
                <span className="font-bold text-foreground">
                  {confirmDialog.checker.full_name}
                </span>{" "}
                ({confirmDialog.checker.email})?
              </p>
              <p>
                A temporary password will be shown once. Share it securely with
                the checker.
              </p>
            </div>
          ),
        };
      case "reset_all_pins": {
        const profileCount = confirmDialog.checker.profiles?.length ?? 0;
        return {
          title: "Reset all PINs?",
          confirmLabel: isPending ? "Resetting..." : "Yes, reset all PINs",
          danger: false,
          body: (
            <div className="space-y-2 text-sm text-text-secondary">
              <p>
                Reset PINs for every profile on{" "}
                <span className="font-bold text-foreground">
                  {confirmDialog.checker.full_name}
                </span>
                &apos;s account.
              </p>
              {profileCount > 1 && (
                <p>
                  This sets the same temporary PIN on all {profileCount}{" "}
                  profiles.
                </p>
              )}
              <p>
                A temporary PIN will be shown once. If they already had a PIN,
                you can undo this reset for 24 hours.
              </p>
              <p>
                To reset only one profile, open View profiles and use that
                profile&apos;s Reset PIN button.
              </p>
            </div>
          ),
        };
      }
      case "reset_profile_pin":
        return {
          title: "Reset this profile's PIN?",
          confirmLabel: isPending ? "Resetting..." : "Yes, reset PIN",
          danger: false,
          body: (
            <div className="space-y-2 text-sm text-text-secondary">
              <p>
                Reset PIN for profile{" "}
                <span className="font-bold text-foreground">
                  {confirmDialog.profile.display_name}
                </span>{" "}
                only.
              </p>
              <p>
                A temporary PIN will be shown once. Other profiles on this
                account are unchanged. If this profile already had a PIN, you
                can undo for 24 hours.
              </p>
            </div>
          ),
        };
      case "restore_all_pins":
        return {
          title: "Restore previous PINs?",
          confirmLabel: isPending ? "Restoring..." : "Yes, restore",
          danger: false,
          body: (
            <div className="space-y-2 text-sm text-text-secondary">
              <p>
                Restore the previous PIN for all profiles on{" "}
                <span className="font-bold text-foreground">
                  {confirmDialog.checkerName}
                </span>
                ?
              </p>
              <p>
                The temporary PIN will stop working. This undo can only be used
                once.
              </p>
            </div>
          ),
        };
      case "restore_profile_pin":
        return {
          title: "Restore previous PIN?",
          confirmLabel: isPending ? "Restoring..." : "Yes, restore",
          danger: false,
          body: (
            <div className="space-y-2 text-sm text-text-secondary">
              <p>
                Restore the previous PIN for{" "}
                <span className="font-bold text-foreground">
                  {confirmDialog.displayName}
                </span>{" "}
                only?
              </p>
              <p>
                The temporary PIN will stop working. This undo can only be used
                once.
              </p>
            </div>
          ),
        };
    }
  })();

  return (
    <>
      {success && (
        <div className="mx-auto mb-4 flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <span className="break-all">{success}</span>
          <div className="flex shrink-0 items-center gap-3">
            {canPinManage && undoPinProfileId && (
              <button
                type="button"
                onClick={() =>
                  handleRestoreProfilePin({
                    id: undoPinProfileId,
                    display_name: undoPinProfileName ?? "this profile",
                  })
                }
                disabled={isPending}
                className="font-bold underline disabled:opacity-60"
              >
                Undo / Restore previous PIN
              </button>
            )}
            {canPinManage && !undoPinProfileId && undoPinCheckerId && (
              <button
                type="button"
                onClick={() =>
                  handleRestorePins(
                    undoPinCheckerId,
                    undoPinCheckerName ?? undefined
                  )
                }
                disabled={isPending}
                className="font-bold underline disabled:opacity-60"
              >
                Undo / Restore previous PIN
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSuccess(null);
                clearUndoPinState();
              }}
              className="font-bold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {!modalMode && error && (
        <div className="mx-auto mb-4 flex max-w-7xl items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold">Checkers</h2>
            <p className="text-sm text-text-secondary">
              Manage mobile app users
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={openAddModal}
              className="flex items-center gap-2 rounded bg-maroon px-4 py-2 text-sm font-bold text-white"
            >
              <Plus className="size-4" />
              Add Checker
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border bg-white p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name or email..."
              className="h-10 w-full rounded border border-border pl-10 pr-3 text-sm outline-none"
            />
          </div>

          <select
            className="h-10 min-w-[220px] rounded border border-border px-3 text-sm"
            value={effectiveDepartment}
            onChange={(e) => handleDepartmentChange(e.target.value)}
            disabled={Boolean(scopedDepartment)}
          >
            {!scopedDepartment && <option value="all">All departments</option>}
            {deptOptions.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
            {!scopedDepartment && (
              <>
                <option value="ssg">{SSG_LABEL}</option>
                <option value="employee">{EMPLOYEE_LABEL}</option>
              </>
            )}
          </select>
        </div>

        <div className="overflow-hidden rounded-[10px] border border-border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-header-bg">
              <tr className="text-left text-text-secondary">
                <th className="px-4 py-3 font-bold">Name</th>
                <th className="px-4 py-3 font-bold">Email</th>
                <th className="px-4 py-3 font-bold">Department</th>
                <th className="px-4 py-3 font-bold">Profiles</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>

            <tbody>
              {checkers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-text-secondary"
                  >
                    {search || department !== "all"
                      ? "No checkers match your filters."
                      : "No checkers found in the database."}
                  </td>
                </tr>
              ) : (
                checkers.map((checker) => (
                  <tr key={checker.id} className="border-b border-border">
                    <td className="px-4 py-4 font-bold">{checker.full_name}</td>
                    <td className="px-4 py-4 text-text-secondary">
                      {checker.email}
                    </td>
                    <td className="px-4 py-4">
                      {checker.checker_scope === "ssg" ? (
                        <Badge>{SSG_LABEL}</Badge>
                      ) : checker.checker_scope === "employee" ? (
                        <Badge>{EMPLOYEE_LABEL}</Badge>
                      ) : checker.department ? (
                        <Badge dept={checker.department}>
                          {checker.department}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-4 text-text-secondary">
                      {profileSummary(checker)}
                    </td>
                    <td className="px-4 py-4">
                      <Badge
                        variant={
                          checker.status === "active" ? "active" : "inactive"
                        }
                      >
                        {displayUserStatus(checker.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openViewModal(checker)}
                          className="rounded p-1 hover:bg-gray-100"
                          aria-label={`View profiles for ${checker.full_name}`}
                          title="View profiles"
                        >
                          <Eye className="size-4" />
                        </button>

                        {canManage && (
                          <button
                            type="button"
                            onClick={() => openEditModal(checker)}
                            className="rounded p-1 hover:bg-gray-100"
                            aria-label={`Edit ${checker.full_name}`}
                          >
                            <Pencil className="size-4" />
                          </button>
                        )}

                        {canManage && (
                          <button
                            type="button"
                            onClick={() => handleResetPassword(checker)}
                            disabled={isPending}
                            className="rounded p-1 hover:bg-gray-100 disabled:opacity-60"
                            aria-label={`Reset password for ${checker.full_name}`}
                            title="Reset password"
                          >
                            <KeyRound className="size-4" />
                          </button>
                        )}

                        {canPinManage && (
                          <button
                            type="button"
                            onClick={() => handleResetPins(checker)}
                            disabled={isPending}
                            className="rounded p-1 hover:bg-gray-100 disabled:opacity-60"
                            aria-label={`Reset all PINs for ${checker.full_name}`}
                            title="Reset all PINs on this account"
                          >
                            <Hash className="size-4" />
                          </button>
                        )}

                        {canPinManage && checker.canRestorePreviousPin && (
                          <button
                            type="button"
                            onClick={() =>
                              handleRestorePins(checker.id, checker.full_name)
                            }
                            disabled={isPending}
                            className="rounded p-1 hover:bg-gray-100 disabled:opacity-60"
                            aria-label={`Restore previous PIN for ${checker.full_name}`}
                            title="Restore previous PIN"
                          >
                            <Undo2 className="size-4" />
                          </button>
                        )}

                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDelete(checker)}
                            disabled={isPending}
                            className="rounded p-1 text-maroon hover:bg-gray-100 disabled:opacity-60"
                            aria-label={`Delete ${checker.full_name}`}
                            title="Delete checker"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}

                        {canManage && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(checker.id)}
                            className="rounded p-1 hover:bg-gray-100"
                            aria-label="Toggle checker status"
                          >
                            {checker.status === "active" ? (
                              <Ban className="size-4" />
                            ) : (
                              <Check className="size-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="checkers"
          />
        </div>
      </div>

      <Modal
        open={modalMode !== null}
        onClose={closeModal}
        title={
          isView
            ? "Checker profiles"
            : isEdit
              ? "Edit Checker"
              : "Add Checker"
        }
        panelClassName="max-w-lg"
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              disabled={isPending}
              className="px-4 py-2 text-sm font-bold text-foreground disabled:opacity-60"
            >
              {isView ? "Close" : "Cancel"}
            </button>
            {isView && canManage && (
              <button
                type="button"
                onClick={() => openEditModal(selectedChecker!)}
                disabled={isPending}
                className="rounded bg-maroon px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                Edit account
              </button>
            )}
            {isEdit && isSuperAdmin && (
              <button
                type="button"
                onClick={() => handleDelete(selectedChecker!)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-60"
              >
                Delete
              </button>
            )}
            {(isEdit || isAdd) && (
              <button
                type="submit"
                form={formId}
                disabled={isPending}
                className="rounded bg-maroon px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {isPending
                  ? "Saving..."
                  : isEdit
                    ? "Save Changes"
                    : "Add Checker"}
              </button>
            )}
          </>
        }
      >
        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <CheckerForm
          key={`${modalMode}-${selectedChecker?.id ?? "new"}`}
          formId={formId}
          checker={selectedChecker}
          canEditEmail={isSuperAdmin}
          readOnly={Boolean(isView)}
          onSubmit={isView ? undefined : handleSave}
          allowedDepartments={deptOptions}
          lockedDepartment={scopedDepartment}
          canPinManage={canPinManage}
          pinActionsPending={isPending}
          onResetProfilePin={
            canPinManage ? handleResetProfilePin : undefined
          }
          onRestoreProfilePin={
            canPinManage ? handleRestoreProfilePin : undefined
          }
        />

        {isEdit && (canManage || canPinManage) && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            {canManage && (
              <button
                type="button"
                onClick={() => handleResetPassword(selectedChecker!)}
                disabled={isPending}
                className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm font-bold disabled:opacity-60"
              >
                <KeyRound className="size-4" />
                Reset password
              </button>
            )}
            {canPinManage && (
              <button
                type="button"
                onClick={() => handleResetPins(selectedChecker!)}
                disabled={isPending}
                className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm font-bold disabled:opacity-60"
              >
                <Hash className="size-4" />
                Reset all PINs
              </button>
            )}
            {canPinManage && selectedChecker?.canRestorePreviousPin && (
              <button
                type="button"
                onClick={() =>
                  handleRestorePins(
                    selectedChecker!.id,
                    selectedChecker!.full_name
                  )
                }
                disabled={isPending}
                className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm font-bold disabled:opacity-60"
              >
                <Undo2 className="size-4" />
                Restore all previous PINs
              </button>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={confirmDialog !== null}
        onClose={closeConfirmDialog}
        title={confirmCopy?.title ?? "Confirm"}
        overlayClassName="z-[60] items-center"
        panelClassName="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={closeConfirmDialog}
              disabled={isPending}
              className="px-4 py-2 text-sm font-bold text-foreground disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={executeConfirm}
              disabled={isPending}
              className={
                confirmCopy?.danger
                  ? "rounded bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  : "rounded bg-maroon px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              }
            >
              {confirmCopy?.confirmLabel ?? "Confirm"}
            </button>
          </>
        }
      >
        {confirmCopy?.body}
      </Modal>
    </>
  );
}
