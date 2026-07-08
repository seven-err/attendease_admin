"use client";

import {
  SESSION_STATUSES,
  SessionWithStats,
} from "@/lib/attendeaseTypes";
import { DEPARTMENTS, YEAR_LEVELS } from "@/lib/constants";
import { SessionCheckerOption } from "@/lib/data/checkers";
import {
  DEFAULT_PHASE_TIMES,
  resolvePhaseTimes,
} from "@/lib/sessionPhase";
import { currentAcademicYear } from "@/lib/validations/student";
import { normalizeTimeForInput } from "@/lib/validations/session";

const inputClass =
  "h-10 w-full rounded border border-border px-3 text-sm outline-none focus:border-maroon";

type SessionFormProps = {
  formId: string;
  session?: SessionWithStats | null;
  checkers: SessionCheckerOption[];
  onSubmit: (formData: FormData) => void;
};

function defaultDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function SessionForm({
  formId,
  session,
  checkers,
  onSubmit,
}: SessionFormProps) {
  const isEdit = Boolean(session);
  const phaseTimes = session
    ? resolvePhaseTimes(session)
    : DEFAULT_PHASE_TIMES;

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
        <label className="mb-1 block text-sm font-bold">Title</label>
        <input
          name="title"
          defaultValue={session?.title ?? ""}
          placeholder="e.g. CCS General Assembly"
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-bold">Description</label>
        <textarea
          name="description"
          defaultValue={session?.description ?? ""}
          placeholder="Optional details"
          rows={2}
          className="w-full rounded border border-border px-3 py-2 text-sm outline-none focus:border-maroon"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-bold">Date</label>
          <input
            name="date"
            type="date"
            defaultValue={session?.date ?? defaultDate()}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-3 rounded border border-border p-4">
        <p className="text-sm font-bold">Time In</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-bold">Start</label>
            <input
              name="time_in_start"
              type="time"
              defaultValue={normalizeTimeForInput(phaseTimes.timeInStart)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold">Limit</label>
            <input
              name="time_in_end"
              type="time"
              defaultValue={normalizeTimeForInput(phaseTimes.timeInEnd)}
              required
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded border border-border p-4">
        <p className="text-sm font-bold">Time Out</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-bold">Start</label>
            <input
              name="time_out_start"
              type="time"
              defaultValue={normalizeTimeForInput(phaseTimes.timeOutStart)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold">Limit</label>
            <input
              name="time_out_end"
              type="time"
              defaultValue={normalizeTimeForInput(phaseTimes.timeOutEnd)}
              required
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-bold">Department</label>
          <select
            name="department"
            defaultValue={session?.department ?? ""}
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
          <label className="mb-1 block text-sm font-bold">Assigned Checker</label>
          <select
            name="assigned_checker_id"
            defaultValue={session?.assigned_checker_id ?? ""}
            className={inputClass}
          >
            <option value="">Unassigned</option>
            {checkers.map((checker) => (
              <option key={checker.id} value={checker.id}>
                {checker.full_name}
                {checker.department ? ` (${checker.department})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-bold">Course</label>
          <input
            name="course"
            defaultValue={session?.course ?? ""}
            placeholder="Optional"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold">Year Level</label>
          <select
            name="year_level"
            defaultValue={session?.year_level ?? ""}
            className={inputClass}
          >
            <option value="">All years</option>
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
            defaultValue={session?.academic_year ?? currentAcademicYear()}
            placeholder="e.g. 2025-2026"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-bold">Status</label>
        <select
          name="status"
          defaultValue={session?.status ?? "Draft"}
          className={inputClass}
        >
          {SESSION_STATUSES.filter((status) =>
            isEdit ? true : status !== "Archived"
          ).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
