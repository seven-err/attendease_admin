"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { downloadCsv } from "@/lib/export-attendance";
import {
  parseStudentImportCsv,
  studentImportCsvTemplate,
  type StudentImportPreview,
  type StudentImportResult,
} from "@/lib/validations/student-import";
import {
  parseStaffImportCsv,
  staffImportCsvTemplate,
  type StaffImportPreview,
} from "@/lib/validations/staff-import";
import {
  executeBulkImport,
  type ImportKind,
  validateBulkImportCsv,
} from "./actions";
import { Download, FileUp, CheckCircle2 } from "lucide-react";

type BulkImportWizardProps = {
  canExecute: boolean;
  scopedDepartment: string | null;
};

type Step =
  | "upload"
  | "validate"
  | "preview"
  | "errors"
  | "confirm"
  | "import"
  | "summary";

const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "validate", label: "Validate" },
  { id: "preview", label: "Preview" },
  { id: "errors", label: "Errors" },
  { id: "confirm", label: "Confirm" },
  { id: "import", label: "Import" },
  { id: "summary", label: "Summary" },
];

export function BulkImportWizard({
  canExecute,
  scopedDepartment,
}: BulkImportWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("upload");
  const [csvText, setCsvText] = useState("");
  const [importKind, setImportKind] = useState<ImportKind>("students");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<
    StudentImportPreview | StaffImportPreview | null
  >(null);
  const [result, setResult] = useState<StudentImportResult | null>(null);

  const clientPreview = useMemo(() => {
    if (!csvText.trim()) return null;
    return importKind === "employees"
      ? parseStaffImportCsv(csvText)
      : parseStudentImportCsv(csvText);
  }, [csvText, importKind]);

  const isEmployeeImport = importKind === "employees";
  const template = isEmployeeImport
    ? staffImportCsvTemplate()
    : studentImportCsvTemplate();

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ""));
      setError(null);
      setPreview(null);
      setResult(null);
      setStep("upload");
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function runValidate() {
    setError(null);
    startTransition(async () => {
      setStep("validate");
      const validation = await validateBulkImportCsv(csvText, importKind);
      if (!validation.success) {
        setError(validation.error);
        setStep("upload");
        return;
      }
      setPreview(validation.preview);
      if (validation.preview.rows.length === 0) {
        setStep("errors");
        return;
      }
      if (validation.preview.errors.length > 0) {
        setStep("errors");
        return;
      }
      setStep("preview");
    });
  }

  function runImport() {
    if (!canExecute) {
      setError("You don't have permission to execute bulk import.");
      return;
    }
    setError(null);
    setStep("import");
    startTransition(async () => {
      try {
        const importResult = await executeBulkImport(csvText, importKind);
        setResult(importResult);
        setStep("summary");
        if (importResult.success) {
          router.refresh();
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Bulk import failed unexpectedly."
        );
        setStep("confirm");
      }
    });
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title="Bulk Import"
        description={
          scopedDepartment
            ? `Import people into ${scopedDepartment} only`
            : "Validate and import roster CSVs"
        }
      />

      <div className="card flex flex-wrap gap-2 p-3">
        {STEPS.map((item, index) => (
          <span
            key={item.id}
            className={`rounded px-2.5 py-1 text-xs font-bold ${
              index <= stepIndex
                ? "bg-maroon text-white"
                : "bg-header-bg text-text-secondary"
            }`}
          >
            {index + 1}. {item.label}
          </span>
        ))}
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {step === "upload" && (
        <div className="card space-y-4 p-5">
          <p className="text-sm text-text-secondary">
            Upload a CSV for students or employees. Employee numbers are
            generated as EMP-DEPARTMENT-001 after the department is selected in
            the CSV.
            {scopedDepartment
              ? ` Rows outside ${scopedDepartment} will be rejected.`
              : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setImportKind("students");
                setCsvText("");
                setPreview(null);
                setResult(null);
              }}
              className={importKind === "students" ? "btn btn-primary" : "btn btn-ghost"}
            >
              Students
            </button>
            <button
              type="button"
              onClick={() => {
                setImportKind("employees");
                setCsvText("");
                setPreview(null);
                setResult(null);
              }}
              className={importKind === "employees" ? "btn btn-primary" : "btn btn-ghost"}
            >
              Employees
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="btn btn-secondary cursor-pointer">
              <FileUp className="size-4" />
              Choose CSV file
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <Button
              variant="ghost"
              onClick={() =>
                downloadCsv(
                  isEmployeeImport
                    ? "employee-import-template.csv"
                    : "student-import-template.csv",
                  template
                )
              }
            >
              <Download className="size-4" />
              Download template
            </Button>
          </div>
          <textarea
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setError(null);
            }}
            rows={10}
            placeholder={template}
            className="w-full rounded border border-border px-3 py-2 font-mono text-xs outline-none focus:border-maroon"
          />
          {clientPreview && (
            <p className="text-sm text-text-secondary">
              Local parse: {clientPreview.rows.length} valid row
              {clientPreview.rows.length !== 1 ? "s" : ""},{" "}
              {clientPreview.errors.length} error
              {clientPreview.errors.length !== 1 ? "s" : ""}.
            </p>
          )}
          <div className="flex justify-end">
            <Button
              onClick={runValidate}
              disabled={isPending || !csvText.trim()}
            >
              Validate CSV
            </Button>
          </div>
        </div>
      )}

      {step === "validate" && (
        <div className="card p-8 text-center text-sm text-text-secondary">
          Validating rows and department scope...
        </div>
      )}

      {(step === "preview" || step === "errors") && preview && (
        <div className="card space-y-4 p-5">
          <div className="flex flex-wrap gap-4 text-sm">
            <p>
              <span className="font-bold">{preview.rows.length}</span> ready
            </p>
            <p>
              <span className="font-bold text-maroon">
                {preview.errors.length}
              </span>{" "}
              issue{preview.errors.length !== 1 ? "s" : ""}
            </p>
          </div>

          {preview.errors.length > 0 && (
            <div className="max-h-48 overflow-auto rounded border border-border">
              <table className="w-full text-sm">
                <thead className="bg-header-bg text-left text-xs uppercase text-text-secondary">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.errors.map((item, index) => (
                    <tr key={`${item.row}-${index}`} className="border-t border-border">
                      <td className="px-3 py-2 font-mono">{item.row || "—"}</td>
                      <td className="px-3 py-2">{item.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.rows.length > 0 && (
            <div className="max-h-64 overflow-auto rounded border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-header-bg text-left text-xs uppercase text-text-secondary">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">
                      {isEmployeeImport ? "Employee #" : "Student #"}
                    </th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Dept</th>
                    <th className="px-3 py-2">
                      {isEmployeeImport ? "Job Title" : "Course"}
                    </th>
                    <th className="px-3 py-2">
                      {isEmployeeImport ? "Status" : "Year"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 50).map((row) => (
                    <tr key={row.rowNumber} className="border-t border-border">
                      <td className="px-3 py-2 font-mono">{row.rowNumber}</td>
                      <td className="px-3 py-2 font-mono">
                        {"student_number" in row
                          ? row.student_number
                          : `EMP-${row.department}-...`}
                      </td>
                      <td className="px-3 py-2 font-bold">{row.full_name}</td>
                      <td className="px-3 py-2">{row.department}</td>
                      <td className="px-3 py-2">
                        {"course" in row ? row.course : row.job_title}
                      </td>
                      <td className="px-3 py-2">
                        {"year_level" in row ? row.year_level : row.person_status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 50 && (
                <p className="border-t border-border px-3 py-2 text-xs text-text-muted">
                  Showing first 50 of {preview.rows.length} rows.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep("upload")}>
              Back
            </Button>
            <div className="flex gap-2">
              {step === "errors" && preview.rows.length > 0 && (
                <Button variant="secondary" onClick={() => setStep("preview")}>
                  Continue with valid rows
                </Button>
              )}
              {preview.rows.length > 0 && (
                <Button onClick={() => setStep("confirm")}>
                  Continue to confirm
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {step === "confirm" && preview && (
        <div className="card space-y-4 p-5">
          <p className="text-sm text-text-secondary">
            You are about to import{" "}
            <span className="font-bold text-foreground">
              {preview.rows.length}
            </span>{" "}
            {isEmployeeImport ? "employee" : "student"}
            {preview.rows.length !== 1 ? "s" : ""}.
            {preview.errors.length > 0
              ? ` ${preview.errors.length} row issue(s) will be skipped.`
              : ""}
          </p>
          {!canExecute && (
            <Alert variant="warning">
              You can validate imports, but you need{" "}
              <span className="font-bold">bulk_import.execute</span> to run
              them.
            </Alert>
          )}
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep("preview")}>
              Back
            </Button>
            <Button
              onClick={runImport}
              disabled={!canExecute || isPending || preview.rows.length === 0}
            >
              Confirm import
            </Button>
          </div>
        </div>
      )}

      {step === "import" && (
        <div className="card p-8 text-center text-sm text-text-secondary">
          Importing {isEmployeeImport ? "employees" : "students"}...
        </div>
      )}

      {step === "summary" && result && (
        <div className="card space-y-4 p-5">
          {result.success ? (
            <>
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="size-5" />
                <p className="font-bold">Import complete</p>
              </div>
              <p className="text-sm">
                Imported {result.imported}. Skipped {result.skipped}.
                {result.errors.length > 0
                  ? ` ${result.errors.length} row issue(s) logged.`
                  : ""}
              </p>
              {result.errors.length > 0 && (
                <div className="max-h-40 overflow-auto rounded border border-border text-sm">
                  {result.errors.slice(0, 30).map((item, index) => (
                    <p
                      key={`${item.row}-${index}`}
                      className="border-b border-border-subtle px-3 py-2"
                    >
                      Row {item.row || "—"}: {item.message}
                    </p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <Alert variant="error">{result.error}</Alert>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setCsvText("");
                setPreview(null);
                setResult(null);
                setStep("upload");
              }}
            >
              Import another file
            </Button>
            <Button onClick={() => router.push("/students")}>
              Go to People
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
