"use client";

import { useState } from "react";
import type { StaffWithAssignment } from "@/lib/attendeaseTypes";
import { DEPARTMENTS, STAFF_ORG_UNITS } from "@/lib/constants";
import { STAFF_STATUSES, type StaffStatus } from "@/lib/validations/staff-import";

const inputClass =
  "h-10 w-full rounded border border-border px-3 text-sm outline-none focus:border-maroon";

const STAFF_DEPARTMENTS = [...DEPARTMENTS, ...STAFF_ORG_UNITS] as const;

type StaffFormProps = {
  formId: string;
  staff?: StaffWithAssignment | null;
  onSubmit: (formData: FormData) => void;
  allowedDepartments?: readonly string[];
  lockedDepartment?: string | null;
};

function defaultValues(staff?: StaffWithAssignment | null) {
  return {
    person_number: staff?.person_number ?? "",
    full_name: staff?.full_name ?? "",
    person_status: (staff?.person_status as StaffStatus) ?? "Active",
    department: staff?.department ?? "",
    job_title: staff?.job_title ?? "",
  };
}

function previewEmployeeNumber(department: string): string {
  if (!department) return "EMP-(department)-001";
  return `EMP-${department}-###`;
}

export function StaffForm({
  formId,
  staff,
  onSubmit,
  allowedDepartments = STAFF_DEPARTMENTS,
  lockedDepartment = null,
}: StaffFormProps) {
  const values = defaultValues(staff);
  const departmentOptions = lockedDepartment
    ? [lockedDepartment]
    : [...allowedDepartments];
  const [department, setDepartment] = useState(
    lockedDepartment ||
      values.department ||
      (departmentOptions.length === 1 ? departmentOptions[0] : "")
  );

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-4"
    >
      {staff?.assignment_id && (
        <input type="hidden" name="assignment_id" value={staff.assignment_id} />
      )}
      {staff?.department && (
        <input
          type="hidden"
          name="previous_department"
          value={staff.department}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-bold">Employee #</label>
          <input
            value={
              staff?.person_number
                ? department && department !== staff.department
                  ? previewEmployeeNumber(department)
                  : staff.person_number
                : previewEmployeeNumber(department)
            }
            readOnly
            className={`${inputClass} bg-gray-50 font-mono text-xs text-text-secondary`}
          />
          <p className="mt-1 text-xs text-text-muted">
            Auto-formatted as EMP-DEPARTMENT-000 when saved.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold">Status</label>
          <select
            name="person_status"
            defaultValue={values.person_status}
            className={inputClass}
          >
            {STAFF_STATUSES.map((status) => (
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
          placeholder="e.g. Ana Reyes"
          required
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-bold">Department</label>
          <select
            name="department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
            disabled={Boolean(lockedDepartment)}
            className={inputClass}
          >
            {!lockedDepartment && <option value="">Select department</option>}
            {departmentOptions.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
          {lockedDepartment && (
            <input type="hidden" name="department" value={lockedDepartment} />
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold">Job Title</label>
          <input
            name="job_title"
            defaultValue={values.job_title}
            placeholder="e.g. IT Staff"
            required
            className={inputClass}
          />
        </div>
      </div>

      {staff?.qr_token && (
        <div>
          <label className="mb-1 block text-sm font-bold">QR Token</label>
          <input
            value={staff.qr_token}
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
