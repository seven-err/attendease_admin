"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { StudentWithAcademic } from "@/lib/attendeaseTypes";
import { DEPARTMENTS, YEAR_LEVELS } from "@/lib/constants";
import { useListParams } from "@/lib/hooks/useListParams";
import type { PageSize } from "@/lib/pagination";
import { truncateToken } from "@/lib/format";
import { archiveStudent, createStudent, updateStudent } from "./actions";
import { ImportCsvModal } from "./ImportCsvModal";
import { StudentForm } from "./StudentForm";
import { Archive, FileUp, Pencil, Plus, Search } from "lucide-react";

type ModalMode = "add" | "edit" | null;

type StudentsTableProps = {
  students: StudentWithAcademic[];
  page: number;
  pageSize: PageSize;
  total: number;
  totalPages: number;
  search: string;
  department: string;
  yearLevel: string;
};

export function StudentsTable({
  students,
  page,
  pageSize,
  total,
  totalPages,
  search,
  department,
  yearLevel,
}: StudentsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { searchInput, setSearchInput, setPage, setPageSize, updateParams } =
    useListParams(search);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedStudent, setSelectedStudent] =
    useState<StudentWithAcademic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  function openAddModal() {
    setSelectedStudent(null);
    setError(null);
    setModalMode("add");
  }

  function openEditModal(student: StudentWithAcademic) {
    setSelectedStudent(student);
    setError(null);
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedStudent(null);
    setError(null);
  }

  function handleSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result =
        modalMode === "edit" && selectedStudent
          ? await updateStudent(selectedStudent.id, formData)
          : await createStudent(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      closeModal();
      setSuccess(
        modalMode === "edit"
          ? "Student updated successfully."
          : "Student added successfully."
      );
      router.refresh();
    });
  }

  function handleArchive(studentId: string) {
    setError(null);
    startTransition(async () => {
      const result = await archiveStudent(studentId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      closeModal();
      setSuccess("Student archived successfully.");
      router.refresh();
    });
  }

  const formId = "student-form";
  const isEdit = modalMode === "edit";

  function updateFilter(key: "dept" | "year", value: string) {
    updateParams({
      [key]: value === "all" ? undefined : value,
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
          title="Students"
          description="Manage student records and QR tokens"
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
                Add Student
              </Button>
            </>
          }
        />

        <div className="card flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search students..."
              className="input-field pl-10"
            />
          </div>

          <select
            className="select-field min-w-[180px]"
            value={department}
            onChange={(e) => updateFilter("dept", e.target.value)}
          >
            <option value="all">All departments</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          <select
            className="select-field min-w-[180px]"
            value={yearLevel}
            onChange={(e) => updateFilter("year", e.target.value)}
          >
            <option value="all">All year levels</option>
            {YEAR_LEVELS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="card overflow-hidden">
          <div className="card-header">
            <h3 className="font-bold">Student Directory</h3>
            <span className="text-xs text-text-secondary">
              {total} student{total !== 1 ? "s" : ""} total
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="table-row-hover w-full min-w-[800px] text-sm">
              <thead className="border-b border-border bg-header-bg">
                <tr className="text-left text-xs uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-3 font-bold">Student #</th>
                  <th className="px-4 py-3 font-bold">Full Name</th>
                  <th className="px-4 py-3 font-bold">Dept</th>
                  <th className="px-4 py-3 font-bold">Course</th>
                  <th className="px-4 py-3 font-bold">Year</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">QR Token</th>
                  <th className="px-4 py-3 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-text-secondary"
                    >
                      {search || department !== "all" || yearLevel !== "all"
                        ? "No students match your filters."
                        : "No students found in the database."}
                    </td>
                  </tr>
                ) : (
                  students.map((student) => (
                    <tr key={student.id} className="border-b border-border-subtle">
                      <td className="px-4 py-4 font-mono text-sm">
                        {student.student_number}
                      </td>
                      <td className="px-4 py-4 font-bold">
                        {student.full_name}
                      </td>
                      <td className="px-4 py-4">
                        {student.department ? (
                          <Badge dept={student.department}>
                            {student.department}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-4">{student.course ?? "—"}</td>
                      <td className="px-4 py-4">{student.year_level ?? "—"}</td>
                      <td className="px-4 py-4">
                        <Badge
                          variant={
                            student.student_status === "Active"
                              ? "active"
                              : "inactive"
                          }
                        >
                          {student.student_status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-text-secondary">
                        {truncateToken(student.qr_token)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(student)}
                            className="btn-icon"
                            aria-label={`Edit ${student.full_name}`}
                          >
                            <Pencil className="size-4" />
                          </button>
                          {student.student_status !== "Archived" && (
                            <button
                              type="button"
                              onClick={() => handleArchive(student.id)}
                              className="btn-icon"
                              aria-label={`Archive ${student.full_name}`}
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
            itemLabel="students"
          />
        </div>
      </div>

      <ImportCsvModal
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
        title={isEdit ? "Edit Student" : "Add Student"}
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
            {isEdit && selectedStudent?.student_status !== "Archived" && (
              <button
                type="button"
                onClick={() => handleArchive(selectedStudent!.id)}
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
                  : "Add Student"}
            </button>
          </>
        }
      >
        {error && (
          <p className="alert alert-error mb-4">
            {error}
          </p>
        )}
        <StudentForm
          key={selectedStudent?.id ?? "new"}
          formId={formId}
          student={selectedStudent}
          onSubmit={handleSave}
        />
      </Modal>
    </>
  );
}
