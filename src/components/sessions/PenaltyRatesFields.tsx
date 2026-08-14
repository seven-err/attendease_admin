"use client";

import {
  applyAbsentChange,
  applyIncompleteChange,
  formatPeso,
  incompletePenaltyPhp,
  parsePenaltyPhpInput,
  penaltyInputFromAmount,
  type PenaltyFormState,
} from "@/lib/penalties";

const inputClass =
  "h-10 w-full rounded border border-border px-3 pl-7 text-sm outline-none focus:border-maroon";

type PenaltyRatesFieldsProps = {
  value: PenaltyFormState;
  onChange: (value: PenaltyFormState) => void;
  inheritedFromMain?: boolean;
  onResetToMain?: () => void;
};

export function PenaltyRatesFields({
  value,
  onChange,
  inheritedFromMain = false,
  onResetToMain,
}: PenaltyRatesFieldsProps) {
  const parsedAbsent = parsePenaltyPhpInput(value.absent);
  const half = incompletePenaltyPhp(parsedAbsent.ok ? parsedAbsent.value : 0);

  return (
    <div className="space-y-3 rounded border border-border p-4">
      <p className="text-sm font-bold">Penalties (₱)</p>
      <p className="text-xs text-text-muted">
        Late applies when both Time In and Time Out are recorded. No Time In /
        No Time Out defaults to half of Absent — change it if you want a
        different amount. Leave blank for ₱0.00.
      </p>
      {inheritedFromMain ? (
        <p className="text-xs font-bold text-maroon">
          Using main session defaults. Edit to customize this sub-session.
        </p>
      ) : onResetToMain ? (
        <button
          type="button"
          onClick={onResetToMain}
          className="text-xs font-bold text-maroon hover:underline"
        >
          Reset to main session defaults
        </button>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-bold">Late</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
              ₱
            </span>
            <input
              name="penalty_late_php"
              value={value.late}
              onChange={(event) =>
                onChange({ ...value, late: event.target.value })
              }
              inputMode="decimal"
              placeholder="0"
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold">Absent</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
              ₱
            </span>
            <input
              name="penalty_absent_php"
              value={value.absent}
              onChange={(event) =>
                onChange(applyAbsentChange(value, event.target.value))
              }
              inputMode="decimal"
              placeholder="0"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-bold">
          No Time In / No Time Out
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
            ₱
          </span>
          <input
            name="penalty_incomplete_php"
            value={value.incomplete}
            onChange={(event) =>
              onChange(applyIncompleteChange(value, event.target.value))
            }
            inputMode="decimal"
            placeholder="0"
            className={inputClass}
          />
        </div>
        {value.incompleteFollowsAbsent ? (
          <p className="mt-1 text-xs text-text-muted">
            Auto: half of Absent ({formatPeso(half)})
          </p>
        ) : (
          <button
            type="button"
            onClick={() =>
              onChange({
                ...value,
                incomplete: penaltyInputFromAmount(half),
                incompleteFollowsAbsent: true,
              })
            }
            className="mt-1 text-xs font-bold text-maroon hover:underline"
          >
            Use half of Absent ({formatPeso(half)})
          </button>
        )}
      </div>
    </div>
  );
}
