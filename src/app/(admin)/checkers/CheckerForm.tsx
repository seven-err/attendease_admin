"use client";

import { useMemo } from "react";
import { CheckerRow } from "@/lib/attendeaseTypes";
import { CHECKER_DEPARTMENTS, SSG_LABEL } from "@/lib/constants";

const inputClass =
  "h-10 w-full rounded border border-border px-3 text-sm outline-none focus:border-maroon";

type CheckerFormProps = {
  formId: string;
  checker?: CheckerRow | null;
  onSubmit: (formData: FormData) => void;
};

function checkerDepartmentValue(checker?: CheckerRow | null): string {
  if (!checker) return "";
  if (checker.checker_scope === "ssg") return SSG_LABEL;
  return checker.department ?? "";
}

export function CheckerForm({ formId, checker, onSubmit }: CheckerFormProps) {
  const defaults = useMemo(
    () => ({
      full_name: checker?.full_name ?? "",
      email: checker?.email ?? "",
      department: checkerDepartmentValue(checker),
    }),
    [checker]
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-bold">Full Name</label>
          <input
            name="full_name"
            defaultValue={defaults.full_name}
            placeholder="e.g. Andres Bonifacio"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold">Email</label>
          <input
            name="email"
            defaultValue={defaults.email}
            placeholder="name@attendease.edu"
            required
            readOnly={Boolean(checker)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-bold">Department</label>
        <select
          name="department"
          defaultValue={defaults.department}
          required
          className={inputClass}
        >
          <option value="">Select department</option>
          {CHECKER_DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-text-muted">
          SSG checkers can access all departments.
        </p>
      </div>
    </form>
  );
}
