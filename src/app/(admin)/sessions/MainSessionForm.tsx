"use client";

import {
  MAIN_SESSION_STATUSES,
  MainSession,
} from "@/lib/attendeaseTypes";
import { DEPARTMENTS } from "@/lib/constants";
import { currentAcademicYear } from "@/lib/validations/student";

const inputClass =
  "h-10 w-full rounded border border-border px-3 text-sm outline-none focus:border-maroon";

type MainSessionFormProps = {
  formId: string;
  mainSession?: MainSession | null;
  lockedDepartment?: string | null;
  onSubmit: (formData: FormData) => void;
};

export function MainSessionForm({
  formId,
  mainSession,
  lockedDepartment = null,
  onSubmit,
}: MainSessionFormProps) {
  const isEdit = Boolean(mainSession);
  const statusOptions = MAIN_SESSION_STATUSES.filter(
    (status) => status !== "Trashed" && (isEdit || status === "Active")
  );
  const departmentOptions = lockedDepartment
    ? [lockedDepartment]
    : [...DEPARTMENTS];
  const defaultDepartment =
    lockedDepartment ||
    mainSession?.department ||
    (departmentOptions.length === 1 ? departmentOptions[0] : "");

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-4"
    >
      <div>
        <label className="mb-1 block text-sm font-bold">Name</label>
        <input
          name="name"
          defaultValue={mainSession?.name ?? ""}
          placeholder="e.g. Foundation Week"
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-bold">Description</label>
        <textarea
          name="description"
          defaultValue={mainSession?.description ?? ""}
          placeholder="Optional details for this event group"
          rows={2}
          className="w-full rounded border border-border px-3 py-2 text-sm outline-none focus:border-maroon"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-bold">Department</label>
          <select
            name="department"
            defaultValue={defaultDepartment}
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
          <label className="mb-1 block text-sm font-bold">Academic Year</label>
          <input
            name="academic_year"
            defaultValue={mainSession?.academic_year ?? currentAcademicYear()}
            placeholder="e.g. 2025-2026"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-bold">Status</label>
        <select
          name="status"
          defaultValue={mainSession?.status ?? "Active"}
          className={inputClass}
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-text-muted">
        Main sessions group related attendance sessions (sub-sessions). Use a
        standalone session when the event does not belong under a main session.
      </p>
    </form>
  );
}
