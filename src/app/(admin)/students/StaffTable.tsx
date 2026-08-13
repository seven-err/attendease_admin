"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import type { StaffWithAssignment } from "@/lib/attendeaseTypes";
import { useListParams } from "@/lib/hooks/useListParams";
import type { PageSize } from "@/lib/pagination";
import { truncateToken } from "@/lib/format";
import { archiveStaff, createStaff, updateStaff } from "./actions";
import { ImportStaffCsvModal } from "./ImportStaffCsvModal";
import { PeopleKindTabs } from "./PeopleKindTabs";
import { StaffForm } from "./StaffForm";
import { Archive, FileUp, Pencil, Plus, Search } from "lucide-react";

type ModalMode = "add" | "edit" | null;

type StaffTableProps = {
  staff: StaffWithAssignment[];
  departments: string[];
  page: number;
  pageSize: PageSize;
  total: number;
  totalPages: number;
  search: string;
  department: string;
  scopedDepartment?: string | null;
};

export function StaffTable({
  staff,
  departments,
  page,
  pageSize,
  total,
  totalPages,
  search,
  department,
  scopedDepartment = null,
}: StaffTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { searchInput, setSearchInput, setPage, setPageSize, updateParams } =
    useListParams(search);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedStaff, setSelectedStaff] =
    useState<StaffWithAssignment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const effectiveDepartment = scopedDepartment ?? department;
  const deptOptions = scopedDepartment ? [scopedDepartment] : departments;

  function openAddModal() {
    setSelectedStaff(null);
    setError(null);
    setModalMode("add");
  }

  function openEditModal(member: StaffWithAssignment) {
    setSelectedStaff(member);
    setError(null);
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedStaff(null);
    setError(null);
  }

  function handleSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result =
        modalMode === "edit" && selectedStaff
          ? await updateStaff(selectedStaff.id, formData)
          : await createStaff(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      closeModal();
      setSuccess(
        modalMode === "edit"
          ? "Employee updated successfully."
          : "Employee added successfully."
      );
      router.refresh();
    });
  }

  function handleArchive(personId: string) {
    setError(null);
    startTransition(async () => {
      const result = await archiveStaff(personId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      closeModal();
      setSuccess("Employee archived successfully.");
      router.refresh();
    });
  }

  const formId = "staff-form";
  const isEdit = modalMode === "edit";

  function updateFilter(value: string) {
    updateParams({
      dept: value === "all" ? undefined : value,
      page: "1",
    });
  }

  return (
    <>
      {success && (
        <Alert
          variant="success"
          onDismiss={() => setSuccess(null)}
          className="mx-auto mb-4 max-w-7xl"
        >
          {success}
        </Alert>
      )}

      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader
          title="People"
          description="Students and CRMC staff roster"
          actions={
            <>
              <Button
                variant="secondary"
                onClick={() => setImportModalOpen(true)}
              >
                <FileUp className="size-4" />
                Import CSV
              </Button>
              <Button onClick={openAddModal}>
                <Plus className="size-4" />
                Add Staff
              </Button>
            </>
          }
        />

        <PeopleKindTabs active="staff" />

        <div className="card flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search staff..."
              className="input-field pl-10"
            />
          </div>

          <select
            className="select-field min-w-[180px]"
            value={effectiveDepartment}
            onChange={(e) => updateFilter(e.target.value)}
            disabled={Boolean(scopedDepartment)}
          >
            {!scopedDepartment && <option value="all">All departments</option>}
            {deptOptions.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div className="card overflow-hidden">
          <div className="card-header">
            <h3 className="font-bold">Staff Directory</h3>
            <span className="text-xs text-text-secondary">
              {total} staff member{total !== 1 ? "s" : ""} total
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="table-row-hover w-full min-w-[800px] text-sm">
              <thead className="border-b border-border bg-header-bg">
                <tr className="text-left text-xs uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-3 font-bold">Employee #</th>
                  <th className="px-4 py-3 font-bold">Full Name</th>
                  <th className="px-4 py-3 font-bold">Dept</th>
                  <th className="px-4 py-3 font-bold">Job title</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">QR Token</th>
                  <th className="px-4 py-3 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-text-secondary"
                    >
                      {search || department !== "all"
                        ? "No staff match your filters."
                        : "No staff found in the database."}
                    </td>
                  </tr>
                ) : (
                  staff.map((member) => (
                    <tr key={member.id} className="border-b border-border-subtle">
                      <td className="px-4 py-4 font-mono text-sm">
                        {member.person_number}
                      </td>
                      <td className="px-4 py-4 font-bold">{member.full_name}</td>
                      <td className="px-4 py-4">
                        {member.department ? (
                          <Badge dept={member.department}>
                            {member.department}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-4">{member.job_title ?? "—"}</td>
                      <td className="px-4 py-4">
                        <Badge
                          variant={
                            member.person_status === "Active"
                              ? "active"
                              : "inactive"
                          }
                        >
                          {member.person_status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-text-secondary">
                        {truncateToken(member.qr_token ?? "")}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(member)}
                            className="btn-icon"
                            aria-label={`Edit ${member.full_name}`}
                          >
                            <Pencil className="size-4" />
                          </button>
                          {member.person_status !== "Archived" && (
                            <button
                              type="button"
                              onClick={() => handleArchive(member.id)}
                              className="btn-icon"
                              aria-label={`Archive ${member.full_name}`}
                            >
                              <Archive className="size-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="staff"
          />
        </div>
      </div>

      <ImportStaffCsvModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={(message) => {
          setSuccess(message);
          router.refresh();
        }}
      />

      <Modal
        open={modalMode !== null}
        onClose={closeModal}
        title={isEdit ? "Edit Staff" : "Add Staff"}
        panelClassName="max-w-lg"
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              disabled={isPending}
              className="btn btn-ghost disabled:opacity-60"
            >
              Cancel
            </button>
            {isEdit && selectedStaff?.person_status !== "Archived" && (
              <button
                type="button"
                onClick={() => handleArchive(selectedStaff!.id)}
                disabled={isPending}
                className="btn btn-ghost text-maroon disabled:opacity-60"
              >
                Archive
              </button>
            )}
            <button
              type="submit"
              form={formId}
              disabled={isPending}
              className="btn btn-primary disabled:opacity-60"
            >
              {isPending
                ? "Saving..."
                : isEdit
                  ? "Save Changes"
                  : "Add Staff"}
            </button>
          </>
        }
      >
        {error && <p className="alert alert-error mb-4">{error}</p>}
        <StaffForm
          key={selectedStaff?.id ?? "new"}
          formId={formId}
          staff={selectedStaff}
          onSubmit={handleSave}
          allowedDepartments={deptOptions}
          lockedDepartment={scopedDepartment}
        />
      </Modal>
    </>
  );
}
