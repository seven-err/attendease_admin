"use client";

import { useMemo, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { SessionAttendancePanel } from "@/components/attendance/SessionAttendancePanel";
import { SESSION_STATUSES, SessionWithStats } from "@/lib/attendeaseTypes";
import { DEPARTMENTS } from "@/lib/constants";
import { SessionCheckerOption } from "@/lib/data/checkers";
import { useAttendanceRealtime, usePollingFallback } from "@/lib/hooks/useAttendanceRealtime";
import {
  displaySessionStatus,
  formatDate,
  formatTimeRange,
  sessionStatusVariant,
} from "@/lib/format";
import {
  archiveSession,
  closeSession,
  createSession,
  openSession,
  updateSession,
} from "./actions";
import { SessionForm } from "./SessionForm";
import {
  Eye,
  Calendar,
  Clock,
  Info,
  Pencil,
  Plus,
  Search,
  User,
} from "lucide-react";

type SessionsGridProps = {
  sessions: SessionWithStats[];
  checkers: SessionCheckerOption[];
};

type ModalMode = "add" | "edit" | null;

export function SessionsGrid({ sessions, checkers }: SessionsGridProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [viewSession, setViewSession] = useState<SessionWithStats | null>(null);
  const [selectedSession, setSelectedSession] =
    useState<SessionWithStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refreshSessions = useCallback(() => {
    router.refresh();
  }, [router]);

  useAttendanceRealtime(refreshSessions);
  usePollingFallback(refreshSessions, true, 5000);

  const filtered = useMemo(() => {
    let list = sessions;

    if (statusFilter !== "all") {
      list = list.filter((session) => session.status === statusFilter);
    }

    if (departmentFilter !== "all") {
      list = list.filter((session) => session.department === departmentFilter);
    }

    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (session) =>
          session.title.toLowerCase().includes(query) ||
          session.department?.toLowerCase().includes(query) ||
          session.checker_name?.toLowerCase().includes(query)
      );
    }

    return list;
  }, [sessions, search, statusFilter, departmentFilter]);

  function openAddModal() {
    setSelectedSession(null);
    setError(null);
    setModalMode("add");
  }

  function openEditModal(session: SessionWithStats) {
    setSelectedSession(session);
    setError(null);
    setModalMode("edit");
  }

  function openViewModal(session: SessionWithStats) {
    setViewSession(session);
  }

  function closeViewModal() {
    setViewSession(null);
  }

  function closeModal() {
    setModalMode(null);
    setSelectedSession(null);
    setError(null);
  }

  function handleSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result =
        modalMode === "edit" && selectedSession
          ? await updateSession(selectedSession.id, formData)
          : await createSession(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      closeModal();
      setSuccess(
        modalMode === "edit"
          ? "Session updated successfully."
          : "Session created successfully."
      );
      router.refresh();
    });
  }

  function handleClose(sessionId: string) {
    setError(null);
    startTransition(async () => {
      const result = await closeSession(sessionId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess("Session closed.");
      router.refresh();
    });
  }

  function handleOpen(sessionId: string) {
    setError(null);
    startTransition(async () => {
      const result = await openSession(sessionId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess("Session opened.");
      router.refresh();
    });
  }

  function handleArchive(sessionId: string) {
    setError(null);
    startTransition(async () => {
      const result = await archiveSession(sessionId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess("Session archived.");
      closeModal();
      router.refresh();
    });
  }

  const formId = "session-form";
  const isEdit = modalMode === "edit";

  return (
    <>
      {success && (
        <div className="mx-auto mb-4 flex max-w-7xl items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <span>{success}</span>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="font-bold"
          >
            Dismiss
          </button>
        </div>
      )}
      {!modalMode && error && (
        <div className="mx-auto mb-4 flex max-w-7xl items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold">Attendance Sessions</h2>
            <p className="text-sm text-text-secondary">
              Track current and past events
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-2 rounded bg-maroon px-4 py-2 text-sm font-bold text-white"
          >
            <Plus className="size-4" />
            Add Session
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-4 rounded-[10px] border border-border bg-white p-4">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-[11px] font-bold uppercase text-text-secondary">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sessions..."
                className="h-10 w-full rounded border border-border pl-10 pr-3 text-sm outline-none"
              />
            </div>
          </div>

          <div className="min-w-[150px]">
            <label className="mb-1 block text-[11px] font-bold uppercase text-text-secondary">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 w-full rounded border border-border px-3 text-sm"
            >
              <option value="all">All status</option>
              {SESSION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[150px]">
            <label className="mb-1 block text-[11px] font-bold uppercase text-text-secondary">
              Department
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-10 w-full rounded border border-border px-3 text-sm"
            >
              <option value="all">All departments</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-[10px] border border-border bg-white p-12 text-center text-text-secondary">
            {sessions.length === 0
              ? "No attendance sessions found."
              : "No sessions match your filters."}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((session) => (
              <div
                key={session.id}
                className="overflow-hidden rounded-[10px] border border-border bg-white"
              >
                <div className="p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex flex-wrap gap-2">
                      {session.department && (
                        <Badge dept={session.department}>
                          {session.department}
                        </Badge>
                      )}
                      <Badge variant={sessionStatusVariant(session.status)}>
                        {displaySessionStatus(session.status)}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditModal(session)}
                      className="rounded p-1 text-text-muted hover:bg-gray-100"
                      aria-label={`Edit ${session.title}`}
                    >
                      <Pencil className="size-4" />
                    </button>
                  </div>
                  <h3 className="mb-3 text-lg font-bold">{session.title}</h3>
                  <div className="space-y-2 text-sm text-text-secondary">
                    <p className="flex items-center gap-2">
                      <Calendar className="size-4" />
                      {formatDate(session.date)}
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="size-4" />
                      {formatTimeRange(session.start_time, session.end_time)}
                    </p>
                    <p className="flex items-center gap-2">
                      <User className="size-4" />
                      {session.checker_name ?? "Unassigned"}
                    </p>
                  </div>
                  {session.status === "Closed" && (
                    <div className="mt-3 flex gap-4 border-t border-border pt-3 text-sm">
                      <span>
                        <strong>{session.present_count}</strong> Present
                      </span>
                      <span className="border-l border-border pl-4">
                        <strong>{session.absent_count}</strong> Absent
                      </span>
                    </div>
                  )}
                  {session.status === "Open" && (
                    <p className="mt-3 text-sm font-bold text-green-600">
                      {session.on_time_count} On Time
                    </p>
                  )}
                  {session.status === "Draft" && (
                    <p className="mt-3 flex items-center gap-1 text-xs text-text-muted">
                      <Info className="size-3.5" />
                      Assign a checker before opening.
                    </p>
                  )}
                </div>
                <div className="flex gap-2 bg-maroon-light px-4 py-3">
                  {session.status === "Draft" && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditModal(session)}
                        className="flex-1 rounded border border-maroon py-2 text-sm font-bold text-maroon"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleOpen(session.id)}
                        className="flex-1 rounded border border-maroon py-2 text-sm font-bold text-maroon disabled:opacity-60"
                      >
                        Open
                      </button>
                    </>
                  )}
                  {session.status === "Open" && (
                    <>
                      <button
                        type="button"
                        onClick={() => openViewModal(session)}
                        className="flex flex-1 items-center justify-center gap-2 rounded border border-maroon py-2 text-sm font-bold text-maroon"
                      >
                        <Eye className="size-4" />
                        View Details
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleClose(session.id)}
                        className="flex-1 rounded border border-maroon py-2 text-sm font-bold text-maroon disabled:opacity-60"
                      >
                        Close Session
                      </button>
                    </>
                  )}
                  {(session.status === "Closed" ||
                    session.status === "Archived") && (
                    <button
                      type="button"
                      onClick={() => openViewModal(session)}
                      className="flex flex-1 items-center justify-center gap-2 rounded border border-maroon py-2 text-sm font-bold text-maroon"
                    >
                      <Eye className="size-4" />
                      View Details
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={modalMode !== null}
        onClose={closeModal}
        title={isEdit ? "Edit Session" : "Add Session"}
        panelClassName="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              disabled={isPending}
              className="px-4 py-2 text-sm font-bold text-foreground disabled:opacity-60"
            >
              Cancel
            </button>
            {isEdit && selectedSession && (
              <button
                type="button"
                onClick={() => handleArchive(selectedSession.id)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-bold text-maroon disabled:opacity-60"
              >
                Archive
              </button>
            )}
            <button
              type="submit"
              form={formId}
              disabled={isPending}
              className="rounded bg-maroon px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {isPending ? "Saving..." : isEdit ? "Save Changes" : "Add Session"}
            </button>
          </>
        }
      >
        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <SessionForm
          key={selectedSession?.id ?? "new"}
          formId={formId}
          session={selectedSession}
          checkers={checkers}
          onSubmit={handleSave}
        />
      </Modal>

      <Modal
        open={viewSession !== null}
        onClose={closeViewModal}
        title={viewSession ? `${viewSession.title} — Attendance` : "Attendance"}
        panelClassName="max-w-4xl"
        footer={
          <button
            type="button"
            onClick={closeViewModal}
            className="px-4 py-2 text-sm font-bold text-foreground"
          >
            Close
          </button>
        }
      >
        {viewSession && (
          <SessionAttendancePanel
            sessionId={viewSession.id}
            sessionTitle={viewSession.title}
            sessionDate={viewSession.date}
          />
        )}
      </Modal>
    </>
  );
}
