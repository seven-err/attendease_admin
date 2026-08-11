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
import { DEPARTMENTS } from "@/lib/constants";
import { downloadCsv } from "@/lib/export-attendance";
import { useListParams } from "@/lib/hooks/useListParams";
import type { PageSize } from "@/lib/pagination";
import { truncateToken } from "@/lib/format";
import {
  exportQrCsv,
  generateMissingQrTokens,
  regenerateQrToken,
} from "./actions";
import { Download, RefreshCw, Sparkles, Search } from "lucide-react";

type QrManagerProps = {
  students: StudentWithAcademic[];
  page: number;
  pageSize: PageSize;
  total: number;
  totalPages: number;
  search: string;
  department: string;
  canGenerate: boolean;
  canRegenerate: boolean;
  canExport: boolean;
  scopedDepartment: string | null;
};

function isMissingToken(token: string | null | undefined): boolean {
  return !token?.trim();
}

export function QrManager({
  students,
  page,
  pageSize,
  total,
  totalPages,
  search,
  department,
  canGenerate,
  canRegenerate,
  canExport,
  scopedDepartment,
}: QrManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { searchInput, setSearchInput, setPage, setPageSize, updateParams } =
    useListParams(search);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmStudent, setConfirmStudent] =
    useState<StudentWithAcademic | null>(null);

  const deptOptions = scopedDepartment ? [scopedDepartment] : [...DEPARTMENTS];
  const effectiveDept = scopedDepartment ?? department;

  function updateDept(value: string) {
    if (scopedDepartment) return;
    updateParams({
      dept: value === "all" ? undefined : value,
      page: "1",
    });
  }

  function handleGenerateMissing() {
    setError(null);
    startTransition(async () => {
      const result = await generateMissingQrTokens();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(
        result.generated
          ? `Generated ${result.generated} missing QR token${result.generated !== 1 ? "s" : ""}.`
          : "No students were missing QR tokens."
      );
      router.refresh();
    });
  }

  function handleGenerateOne(student: StudentWithAcademic) {
    setError(null);
    startTransition(async () => {
      const result = await regenerateQrToken(student.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(`QR token generated for ${student.full_name}.`);
      router.refresh();
    });
  }

  function handleConfirmRegenerate() {
    if (!confirmStudent) return;
    const student = confirmStudent;
    setConfirmStudent(null);
    setError(null);
    startTransition(async () => {
      const result = await regenerateQrToken(student.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(
        `QR token regenerated for ${student.full_name}. Previous codes are invalid.`
      );
      router.refresh();
    });
  }

  function handleExport() {
    setError(null);
    startTransition(async () => {
      const result = await exportQrCsv({
        page,
        pageSize,
        search,
        department: effectiveDept,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      downloadCsv(result.filename, result.csv);
      setSuccess(`Exported ${result.filename}.`);
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
      {error && (
        <Alert
          variant="error"
          onDismiss={() => setError(null)}
          className="mx-auto mb-4 max-w-7xl"
        >
          {error}
        </Alert>
      )}

      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader
          title="QR Management"
          description="Generate, regenerate, and export student QR credentials"
          actions={
            <>
              {canExport && (
                <Button
                  variant="secondary"
                  onClick={handleExport}
                  disabled={isPending || total === 0}
                >
                  <Download className="size-4" />
                  Export CSV
                </Button>
              )}
              {canGenerate && (
                <Button onClick={handleGenerateMissing} disabled={isPending}>
                  <Sparkles className="size-4" />
                  Generate missing
                </Button>
              )}
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
            value={effectiveDept}
            onChange={(e) => updateDept(e.target.value)}
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
            <h3 className="font-bold">QR credentials</h3>
            <span className="text-xs text-text-secondary">
              {total} student{total !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="table-row-hover w-full min-w-[720px] text-sm">
              <thead className="border-b border-border bg-header-bg">
                <tr className="text-left text-xs uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-3 font-bold">Student #</th>
                  <th className="px-4 py-3 font-bold">Name</th>
                  <th className="px-4 py-3 font-bold">Dept</th>
                  <th className="px-4 py-3 font-bold">Token</th>
                  <th className="px-4 py-3 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-text-secondary"
                    >
                      No students match your filters.
                    </td>
                  </tr>
                ) : (
                  students.map((student) => {
                    const missing = isMissingToken(student.qr_token);
                    return (
                      <tr
                        key={student.id}
                        className="border-b border-border-subtle"
                      >
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
                        <td className="px-4 py-4 font-mono text-xs text-text-secondary">
                          {missing ? (
                            <span className="text-maroon">Missing</span>
                          ) : (
                            truncateToken(student.qr_token)
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {missing && canGenerate ? (
                              <Button
                                onClick={() => handleGenerateOne(student)}
                                disabled={isPending}
                                className="h-8 px-3 py-0 text-xs"
                              >
                                <Sparkles className="size-3.5" />
                                Generate
                              </Button>
                            ) : null}
                            {!missing && canRegenerate ? (
                              <Button
                                variant="outline-brand"
                                onClick={() => setConfirmStudent(student)}
                                disabled={isPending}
                                className="h-8 px-3 py-0 text-xs"
                              >
                                <RefreshCw className="size-3.5" />
                                Regenerate
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-4 py-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(confirmStudent)}
        onClose={() => !isPending && setConfirmStudent(null)}
        title="Regenerate QR token?"
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={isPending}
              onClick={() => setConfirmStudent(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isPending}
              onClick={handleConfirmRegenerate}
            >
              {isPending ? "Regenerating..." : "Yes, regenerate"}
            </button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          This will invalidate the existing QR code for{" "}
          <span className="font-bold text-foreground">
            {confirmStudent?.full_name}
          </span>
          . Printed or shared codes will stop working. This action is audited.
        </p>
      </Modal>
    </>
  );
}
