"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { CheckerRow } from "@/lib/attendeaseTypes";
import { DEPARTMENTS, SSG_LABEL } from "@/lib/constants";
import { useListParams } from "@/lib/hooks/useListParams";
import type { PageSize } from "@/lib/pagination";
import { displayUserStatus } from "@/lib/format";
import {
  Archive,
  Ban,
  Check,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { CheckerForm } from "./CheckerForm";
import {
  archiveChecker,
  createChecker,
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
};

export function CheckersTable({
  checkers,
  page,
  pageSize,
  total,
  totalPages,
  search,
  department,
}: CheckersTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { searchInput, setSearchInput, setPage, setPageSize, updateParams } =
    useListParams(search);

  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [selectedChecker, setSelectedChecker] = useState<CheckerRow | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function openAddModal() {
    setSelectedChecker(null);
    setError(null);
    setSuccess(null);
    setModalMode("add");
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

  function handleArchive(checkerId: string) {
    setError(null);
    startTransition(async () => {
      const result = await archiveChecker(checkerId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess("Checker archived successfully.");
      router.refresh();
      closeModal();
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

  return (
    <>
      {success && (
        <div className="mx-auto mb-4 flex max-w-7xl items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <span>{success}</span>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="font-bold"
          >
            Dismiss
          </button>
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
          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-2 rounded bg-maroon px-4 py-2 text-sm font-bold text-white"
          >
            <Plus className="size-4" />
            Add Checker
          </button>
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
            value={department}
            onChange={(e) => handleDepartmentChange(e.target.value)}
          >
            <option value="all">All departments</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
            <option value="ssg">{SSG_LABEL}</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-[10px] border border-border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-header-bg">
              <tr className="text-left text-text-secondary">
                <th className="px-4 py-3 font-bold">Name</th>
                <th className="px-4 py-3 font-bold">Email</th>
                <th className="px-4 py-3 font-bold">Department</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>

            <tbody>
              {checkers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
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
                      ) : checker.department ? (
                        <Badge dept={checker.department}>
                          {checker.department}
                        </Badge>
                      ) : (
                        "—"
                      )}
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
                          onClick={() => openEditModal(checker)}
                          className="rounded p-1 hover:bg-gray-100"
                          aria-label={`Edit ${checker.full_name}`}
                        >
                          <Pencil className="size-4" />
                        </button>

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

                        <button
                          type="button"
                          onClick={() => handleArchive(checker.id)}
                          className="rounded p-1 hover:bg-gray-100"
                          aria-label="Archive checker"
                        >
                          <Archive className="size-4" />
                        </button>
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
        title={isEdit ? "Edit Checker" : "Add Checker"}
        panelClassName="max-w-lg"
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              disabled={isPending}
              className="px-4 py-2 text-sm font-bold text-foreground disabled:opacity-60"
            >
              Cancel
            </button>
            {isEdit && (
              <button
                type="button"
                onClick={() => handleArchive(selectedChecker!.id)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-bold text-maroon disabled:opacity-60"
              >
                Archive
              </button>
            )}
            <button
              type="submit"
              form={formId}
              disabled={isPending}
              className="rounded bg-maroon px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {isPending ? "Saving..." : isEdit ? "Save Changes" : "Add Checker"}
            </button>
          </>
        }
      >
        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <CheckerForm
          key={selectedChecker?.id ?? "new"}
          formId={formId}
          checker={selectedChecker}
          onSubmit={handleSave}
        />
      </Modal>
    </>
  );
}
