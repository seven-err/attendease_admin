"use client";

import {
  STUDENT_STATUSES,
  StudentFormInput,
  StudentWithAcademic,
} from "@/lib/attendeaseTypes";
import { DEPARTMENTS, YEAR_LEVELS } from "@/lib/constants";
import { currentAcademicYear } from "@/lib/validations/student";

const inputClass =
  "h-10 w-full rounded border border-border px-3 text-sm outline-none focus:border-maroon";

type StudentFormProps = {
  formId: string;
  student?: StudentWithAcademic | null;
  onSubmit: (formData: FormData) => void;
};

function defaultValues(student?: StudentWithAcademic | null): StudentFormInput {
  return {
    student_number: student?.student_number ?? "",
    full_name: student?.full_name ?? "",
    student_status: student?.student_status ?? "Active",
    department: student?.department ?? "",
    course: student?.course ?? "",
    year_level: student?.year_level ?? "",
    academic_year: student?.academic_year ?? currentAcademicYear(),
  };
}

export function StudentForm({ formId, student, onSubmit }: StudentFormProps) {
  const values = defaultValues(student);

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-4"
    >
      {student?.academic_record_id && (
        <input
          type="hidden"
          name="academic_record_id"
          value={student.academic_record_id}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-bold">Student #</label>
          <input
            name="student_number"
            defaultValue={values.student_number}
            placeholder="e.g. 2026-0001"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold">Status</label>
          <select
            name="student_status"
            defaultValue={values.student_status}
            className={inputClass}
          >
            {STUDENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-bold">Full Name</label>
        <input
          name="full_name"
          defaultValue={values.full_name}
          placeholder="e.g. Juan Dela Cruz"
          required
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-bold">Department</label>
          <select
            name="department"
            defaultValue={values.department}
            required
            className={inputClass}
          >
            <option value="">Select department</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold">Course</label>
          <input
            name="course"
            defaultValue={values.course}
            placeholder="e.g. BSIT"
            required
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-bold">Year Level</label>
          <select
            name="year_level"
            defaultValue={values.year_level}
            required
            className={inputClass}
          >
            <option value="">Select year</option>
            {YEAR_LEVELS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold">Academic Year</label>
          <input
            name="academic_year"
            defaultValue={values.academic_year}
            placeholder="e.g. 2025-2026"
            className={inputClass}
          />
        </div>
      </div>

      {student?.qr_token && (
        <div>
          <label className="mb-1 block text-sm font-bold">QR Token</label>
          <input
            value={student.qr_token}
            readOnly
            className={`${inputClass} bg-gray-50 font-mono text-xs text-text-secondary`}
          />
          <p className="mt-1 text-xs text-text-muted">
            QR tokens are generated automatically and cannot be edited.
          </p>
        </div>
      )}
    </form>
  );
}
