"use client";

import { useState } from "react";
import {
  MainSession,
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
import { todayDateString } from "@/lib/format";
import { normalizeTimeForInput } from "@/lib/validations/session";

const inputClass =
  "h-10 w-full rounded border border-border px-3 text-sm outline-none focus:border-maroon";

type SessionFormProps = {
  formId: string;
  session?: SessionWithStats | null;
  checkers: SessionCheckerOption[];
  mainSessions: MainSession[];
  /** Prefill when adding a sub-session from a main card. */
  defaultMainSessionId?: string | null;
  lockOrganization?: boolean;
  lockedDepartment?: string | null;
  onSubmit: (formData: FormData) => void;
};

export function SessionForm({
  formId,
  session,
  checkers,
  mainSessions,
  defaultMainSessionId = null,
  lockOrganization = false,
  lockedDepartment = null,
  onSubmit,
}: SessionFormProps) {
  const isEdit = Boolean(session);
  const phaseTimes = session
    ? resolvePhaseTimes(session)
    : DEFAULT_PHASE_TIMES;

  const initialMainId =
    session?.main_session_id ?? defaultMainSessionId ?? "";
  const [organization, setOrganization] = useState<"standalone" | "sub">(
    initialMainId ? "sub" : "standalone"
  );
  const [mainSessionId, setMainSessionId] = useState(initialMainId);

  const activeMains = mainSessions.filter(
    (main) =>
      main.status === "Active" ||
      (isEdit && main.id === session?.main_session_id)
  );
  const departmentOptions = lockedDepartment
    ? [lockedDepartment]
    : [...DEPARTMENTS];
  const inheritedDepartment =
    session?.department ??
    activeMains.find((main) => main.id === mainSessionId)?.department ??
    "";
  const defaultDepartment =
    lockedDepartment ||
    inheritedDepartment ||
    (departmentOptions.length === 1 ? departmentOptions[0] : "");
  const checkerOptions = lockedDepartment
    ? checkers.filter((checker) => checker.department === lockedDepartment)
    : checkers;

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-4"
    >
      <div className="space-y-3 rounded border border-border p-4">
        <p className="text-sm font-bold">Organization</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="organization_kind"
              value="standalone"
              checked={organization === "standalone"}
              disabled={lockOrganization}
              onChange={() => {
                setOrganization("standalone");
                setMainSessionId("");
              }}
            />
            Standalone session
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="organization_kind"
              value="sub"
              checked={organization === "sub"}
              disabled={lockOrganization && Boolean(defaultMainSessionId)}
              onChange={() => setOrganization("sub")}
            />
            Sub-session under a main
          </label>
        </div>

        {organization === "sub" ? (
          <div>
            <label className="mb-1 block text-sm font-bold">Main session</label>
            <select
              name="main_session_id"
              value={mainSessionId}
              required
              disabled={lockOrganization && Boolean(defaultMainSessionId)}
              onChange={(e) => setMainSessionId(e.target.value)}
              className={inputClass}
            >
              <option value="">Select main session</option>
              {activeMains.map((main) => (
                <option key={main.id} value={main.id}>
                  {main.name}
                  {main.department ? ` (${main.department})` : ""}
                </option>
              ))}
            </select>
            {activeMains.length === 0 && (
              <p className="mt-1 text-xs text-text-muted">
                Create a main session first, then add sub-sessions under it.
              </p>
            )}
          </div>
        ) : (
          <input type="hidden" name="main_session_id" value="" />
        )}
      </div>

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
            defaultValue={session?.date ?? todayDateString()}
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
          <label className="mb-1 block text-sm font-bold">Assigned Checker</label>
          <select
            name="assigned_checker_id"
            defaultValue={session?.assigned_checker_id ?? ""}
            className={inputClass}
          >
            <option value="">Unassigned</option>
            {checkerOptions.map((checker) => (
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
