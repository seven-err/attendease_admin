"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_DEPARTMENT_ADMIN_PERMISSIONS,
  HIGH_RISK_PERMISSIONS,
  PERMISSION_DEFINITIONS,
  PERMISSION_GROUPS,
  summarizePermissions,
  type PermissionKey,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckSquare, Square } from "lucide-react";

type PermissionEditorProps = {
  value: PermissionKey[];
  onChange: (next: PermissionKey[]) => void;
  disabled?: boolean;
  showSummary?: boolean;
  className?: string;
};

export function PermissionEditor({
  value,
  onChange,
  disabled = false,
  showSummary = true,
  className,
}: PermissionEditorProps) {
  const [confirmHighRisk, setConfirmHighRisk] = useState(false);
  const selected = useMemo(() => new Set(value), [value]);
  const summary = summarizePermissions(value);
  const pendingHighRisk = HIGH_RISK_PERMISSIONS.filter((key) => selected.has(key));

  function toggle(key: PermissionKey) {
    if (disabled) return;
    const def = PERMISSION_DEFINITIONS.find((p) => p.key === key);
    if (def?.highRisk && !selected.has(key) && !confirmHighRisk) {
      return;
    }
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(
      PERMISSION_DEFINITIONS.map((p) => p.key).filter((k) => next.has(k))
    );
  }

  function selectAll() {
    if (disabled) return;
    if (!confirmHighRisk) {
      onChange(
        PERMISSION_DEFINITIONS.filter((p) => !p.highRisk).map((p) => p.key)
      );
      return;
    }
    onChange(PERMISSION_DEFINITIONS.map((p) => p.key));
  }

  function clearAll() {
    if (disabled) return;
    onChange([]);
  }

  function applyRecommended() {
    if (disabled) return;
    onChange([...DEFAULT_DEPARTMENT_ADMIN_PERMISSIONS]);
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={disabled}
          onClick={selectAll}
        >
          Select all{confirmHighRisk ? "" : " (safe)"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={disabled}
          onClick={clearAll}
        >
          Clear all
        </button>
        <button
          type="button"
          className="btn btn-outline-brand"
          disabled={disabled}
          onClick={applyRecommended}
        >
          Recommended
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={confirmHighRisk}
            disabled={disabled}
            onChange={(e) => setConfirmHighRisk(e.target.checked)}
            className="size-4 accent-[var(--maroon)]"
          />
          Allow high-risk permissions
        </label>
      </div>

      {!confirmHighRisk && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          High-risk actions (delete, void, PIN manage, regenerate QR) stay locked
          until you confirm above.
        </p>
      )}

      <div className="space-y-4">
        {PERMISSION_GROUPS.map((group) => {
          const items = PERMISSION_DEFINITIONS.filter((p) => p.group === group.key);
          const groupSelected = items.filter((p) => selected.has(p.key)).length;
          return (
            <section
              key={group.key}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {group.label}
                </h3>
                <span className="text-xs text-text-muted">
                  {groupSelected}/{items.length}
                </span>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {items.map((item) => {
                  const checked = selected.has(item.key);
                  const locked = item.highRisk && !confirmHighRisk && !checked;
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        disabled={disabled || locked}
                        onClick={() => toggle(item.key)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                          checked
                            ? "border-maroon bg-maroon-light"
                            : "border-border-subtle hover:bg-surface-raised",
                          (disabled || locked) && "opacity-60"
                        )}
                      >
                        {checked ? (
                          <CheckSquare className="mt-0.5 size-4 shrink-0 text-maroon" />
                        ) : (
                          <Square className="mt-0.5 size-4 shrink-0 text-text-muted" />
                        )}
                        <span>
                          <span className="block text-sm font-medium text-foreground">
                            {item.label}
                            {item.highRisk ? (
                              <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                                High risk
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-xs text-text-secondary">
                            {item.description}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {showSummary && (
        <div className="rounded-xl border border-border bg-surface-raised p-4">
          <p className="text-sm font-semibold text-foreground">Access summary</p>
          <p className="mt-1 text-sm text-text-secondary">
            {summary.total} permission{summary.total === 1 ? "" : "s"} selected
            {summary.highRisk > 0
              ? ` · ${summary.highRisk} high-risk`
              : " · no high-risk"}
          </p>
          {pendingHighRisk.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-amber-800">
              {pendingHighRisk.map((key) => (
                <li key={key}>{key}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
