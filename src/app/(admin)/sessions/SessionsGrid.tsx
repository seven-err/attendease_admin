"use client";

import { useMemo, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SessionAttendancePanel } from "@/components/attendance/SessionAttendancePanel";
import {
  MainSession,
  SESSION_STATUSES,
  SessionWithStats,
} from "@/lib/attendeaseTypes";
import { DEPARTMENTS } from "@/lib/constants";
import { SessionCheckerOption } from "@/lib/data/checkers";
import { organizeSessions } from "@/lib/data/session-organization";
import { useAttendanceRealtime, usePollingFallback } from "@/lib/hooks/useAttendanceRealtime";
import {
  displaySessionStatus,
  formatDate,
  formatTimeRange,
  sessionStatusVariant,
} from "@/lib/format";
import {
  archiveMainSession,
  archiveSession,
  closeSession,
  createMainSession,
  createSession,
  openSession,
  updateMainSession,
  updateSession,
} from "./actions";
import { MainSessionForm } from "./MainSessionForm";
import { SessionForm } from "./SessionForm";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  FolderTree,
  Info,
  Layers,
  Pencil,
  Plus,
  Search,
  User,
  Eye,
} from "lucide-react";

type SessionsGridProps = {
  sessions: SessionWithStats[];
  mainSessions: MainSession[];
  checkers: SessionCheckerOption[];
};

type SessionModalMode = "add" | "edit" | null;
type MainModalMode = "add" | "edit" | null;
type OrganizationFilter = "all" | "main" | "standalone";

function OrganizationBadge({
  label,
}: {
  label: "Main" | "Sub-session" | "Standalone";
}) {
  const className =
    label === "Main"
      ? "border border-maroon bg-maroon-light text-maroon"
      : label === "Sub-session"
        ? "border border-border bg-surface-raised text-text-secondary"
        : "border border-info-border bg-info-bg text-info";

  return (
    <Badge className={className} variant="dept">
      {label}
    </Badge>
  );
}

function SessionCard({
  session,
  nested = false,
  isPending,
  onEdit,
  onView,
  onOpen,
  onClose,
}: {
  session: SessionWithStats;
  nested?: boolean;
  isPending: boolean;
  onEdit: (session: SessionWithStats) => void;
  onView: (session: SessionWithStats) => void;
  onOpen: (sessionId: string) => void;
  onClose: (sessionId: string) => void;
}) {
  return (
    <div
      className={
        nested
          ? "overflow-hidden rounded-lg border border-border-subtle bg-surface-raised"
          : "overflow-hidden rounded-[10px] border border-border bg-white"
      }
    >
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <OrganizationBadge
              label={session.main_session_id ? "Sub-session" : "Standalone"}
            />
            {session.department && (
              <Badge dept={session.department}>{session.department}</Badge>
            )}
            <Badge variant={sessionStatusVariant(session.status)}>
              {displaySessionStatus(session.status)}
            </Badge>
          </div>
          <button
            type="button"
            onClick={() => onEdit(session)}
            className="rounded p-1 text-text-muted hover:bg-gray-100"
            aria-label={`Edit ${session.title}`}
          >
            <Pencil className="size-4" />
          </button>
        </div>
        <h3 className="mb-1 text-lg font-bold">{session.title}</h3>
        {session.main_session_name && (
          <p className="mb-3 text-xs text-text-muted">
            Under {session.main_session_name}
          </p>
        )}
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
              onClick={() => onEdit(session)}
              className="flex-1 rounded border border-maroon py-2 text-sm font-bold text-maroon"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => onOpen(session.id)}
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
              onClick={() => onView(session)}
              className="flex flex-1 items-center justify-center gap-2 rounded border border-maroon py-2 text-sm font-bold text-maroon"
            >
              <Eye className="size-4" />
              View Details
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => onClose(session.id)}
              className="flex-1 rounded border border-maroon py-2 text-sm font-bold text-maroon disabled:opacity-60"
            >
              Close Session
            </button>
          </>
        )}
        {(session.status === "Closed" || session.status === "Archived") && (
          <button
            type="button"
            onClick={() => onView(session)}
            className="flex flex-1 items-center justify-center gap-2 rounded border border-maroon py-2 text-sm font-bold text-maroon"
          >
            <Eye className="size-4" />
            View Details
          </button>
        )}
      </div>
    </div>
  );
}

export function SessionsGrid({
  sessions,
  mainSessions,
  checkers,
}: SessionsGridProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [organizationFilter, setOrganizationFilter] =
    useState<OrganizationFilter>("all");
  const [expandedMains, setExpandedMains] = useState<Set<string>>(
    () => new Set(mainSessions.map((main) => main.id))
  );

  const [sessionModalMode, setSessionModalMode] =
    useState<SessionModalMode>(null);
  const [mainModalMode, setMainModalMode] = useState<MainModalMode>(null);
  const [viewSession, setViewSession] = useState<SessionWithStats | null>(null);
  const [selectedSession, setSelectedSession] =
    useState<SessionWithStats | null>(null);
  const [selectedMain, setSelectedMain] = useState<MainSession | null>(null);
  const [defaultMainSessionId, setDefaultMainSessionId] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refreshSessions = useCallback(() => {
    router.refresh();
  }, [router]);

  useAttendanceRealtime(refreshSessions);
  usePollingFallback(refreshSessions, true, 5000);

  const organized = useMemo(
    () => organizeSessions(sessions, mainSessions),
    [sessions, mainSessions]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    function matchesSession(session: SessionWithStats) {
      if (statusFilter !== "all" && session.status !== statusFilter) {
        return false;
      }
      if (
        departmentFilter !== "all" &&
        session.department !== departmentFilter
      ) {
        return false;
      }
      if (!query) return true;
      return (
        session.title.toLowerCase().includes(query) ||
        session.department?.toLowerCase().includes(query) ||
        session.checker_name?.toLowerCase().includes(query) ||
        session.main_session_name?.toLowerCase().includes(query)
      );
    }

    function matchesMain(main: MainSession, subs: SessionWithStats[]) {
      if (
        departmentFilter !== "all" &&
        main.department !== departmentFilter &&
        !subs.some((sub) => sub.department === departmentFilter)
      ) {
        return false;
      }
      if (!query) return true;
      return (
        main.name.toLowerCase().includes(query) ||
        main.department?.toLowerCase().includes(query) ||
        main.description?.toLowerCase().includes(query) ||
        subs.some(matchesSession)
      );
    }

    const mainGroups = organized.mainGroups
      .map((group) => {
        const subs = group.subs.filter(matchesSession);
        if (!matchesMain(group.main, group.subs)) return null;
        // Status filter applies to attendance sessions; keep empty mains only when not filtering status.
        if (statusFilter !== "all" && subs.length === 0) return null;
        return { ...group, subs };
      })
      .filter((group): group is NonNullable<typeof group> => Boolean(group));

    const standalones = organized.standalones.filter(matchesSession);

    return {
      mainGroups:
        organizationFilter === "standalone" ? [] : mainGroups,
      standalones:
        organizationFilter === "main" ? [] : standalones,
    };
  }, [
    organized,
    search,
    statusFilter,
    departmentFilter,
    organizationFilter,
  ]);

  function toggleMainExpanded(mainId: string) {
    setExpandedMains((prev) => {
      const next = new Set(prev);
      if (next.has(mainId)) next.delete(mainId);
      else next.add(mainId);
      return next;
    });
  }

  function openAddStandalone() {
    setSelectedSession(null);
    setDefaultMainSessionId(null);
    setError(null);
    setSessionModalMode("add");
  }

  function openAddSubSession(mainId: string) {
    setSelectedSession(null);
    setDefaultMainSessionId(mainId);
    setError(null);
    setSessionModalMode("add");
    setExpandedMains((prev) => new Set(prev).add(mainId));
  }

  function openEditSession(session: SessionWithStats) {
    setSelectedSession(session);
    setDefaultMainSessionId(session.main_session_id);
    setError(null);
    setSessionModalMode("edit");
  }

  function openAddMain() {
    setSelectedMain(null);
    setError(null);
    setMainModalMode("add");
  }

  function openEditMain(main: MainSession) {
    setSelectedMain(main);
    setError(null);
    setMainModalMode("edit");
  }

  function closeSessionModal() {
    setSessionModalMode(null);
    setSelectedSession(null);
    setDefaultMainSessionId(null);
    setError(null);
  }

  function closeMainModal() {
    setMainModalMode(null);
    setSelectedMain(null);
    setError(null);
  }

  function handleSaveSession(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result =
        sessionModalMode === "edit" && selectedSession
          ? await updateSession(selectedSession.id, formData)
          : await createSession(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      closeSessionModal();
      setSuccess(
        sessionModalMode === "edit"
          ? "Session updated successfully."
          : "Session created successfully."
      );
      router.refresh();
    });
  }

  function handleSaveMain(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result =
        mainModalMode === "edit" && selectedMain
          ? await updateMainSession(selectedMain.id, formData)
          : await createMainSession(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      closeMainModal();
      setSuccess(
        mainModalMode === "edit"
          ? "Main session updated successfully."
          : "Main session created successfully."
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

  function handleArchiveSession(sessionId: string) {
    setError(null);
    startTransition(async () => {
      const result = await archiveSession(sessionId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess("Session archived.");
      closeSessionModal();
      router.refresh();
    });
  }

  function handleArchiveMain(mainId: string) {
    setError(null);
    startTransition(async () => {
      const result = await archiveMainSession(mainId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess("Main session archived. Sub-sessions were left unchanged.");
      closeMainModal();
      router.refresh();
    });
  }

  const sessionFormId = "session-form";
  const mainFormId = "main-session-form";
  const isEditSession = sessionModalMode === "edit";
  const isEditMain = mainModalMode === "edit";
  const hasResults =
    filtered.mainGroups.length > 0 || filtered.standalones.length > 0;

  return (
    <>
      {success && (
        <Alert
          variant="success"
          onDismiss={() => setSuccess(null)}
          className="mx-auto mb-4 max-w-7xl"
        >
          {success}
        </Alert>
      )}
      {!sessionModalMode && !mainModalMode && error && (
        <Alert
          variant="error"
          onDismiss={() => setError(null)}
          className="mx-auto mb-4 max-w-7xl"
        >
          {error}
        </Alert>
      )}

      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader
          title="Attendance Sessions"
          description="Organize events as main sessions with sub-sessions, or as standalone sessions"
          actions={
            <>
              <Button variant="secondary" onClick={openAddMain}>
                <FolderTree className="size-4" />
                Add Main Session
              </Button>
              <Button onClick={openAddStandalone}>
                <Plus className="size-4" />
                Add Session
              </Button>
            </>
          }
        />

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
                placeholder="Search sessions or mains..."
                className="h-10 w-full rounded border border-border pl-10 pr-3 text-sm outline-none"
              />
            </div>
          </div>

          <div className="min-w-[150px]">
            <label className="mb-1 block text-[11px] font-bold uppercase text-text-secondary">
              Organization
            </label>
            <select
              value={organizationFilter}
              onChange={(e) =>
                setOrganizationFilter(e.target.value as OrganizationFilter)
              }
              className="h-10 w-full rounded border border-border px-3 text-sm"
            >
              <option value="all">All</option>
              <option value="main">Main sessions</option>
              <option value="standalone">Standalone only</option>
            </select>
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

        {!hasResults ? (
          <div className="rounded-[10px] border border-border bg-white p-12 text-center text-text-secondary">
            {sessions.length === 0 && mainSessions.length === 0
              ? "No attendance sessions found. Create a main session or a standalone session to get started."
              : "No sessions match your filters."}
          </div>
        ) : (
          <div className="space-y-8">
            {filtered.mainGroups.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-text-secondary">
                  <FolderTree className="size-4" />
                  Main sessions
                </div>
                <div className="space-y-4">
                  {filtered.mainGroups.map(({ main, subs }) => {
                    const expanded = expandedMains.has(main.id);
                    return (
                      <div
                        key={main.id}
                        className="overflow-hidden rounded-[10px] border border-border bg-white"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4">
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <OrganizationBadge label="Main" />
                              {main.department && (
                                <Badge dept={main.department}>
                                  {main.department}
                                </Badge>
                              )}
                              <Badge
                                variant={
                                  main.status === "Active"
                                    ? "status-active"
                                    : "status-draft"
                                }
                              >
                                {main.status}
                              </Badge>
                            </div>
                            <h3 className="text-lg font-bold">{main.name}</h3>
                            {main.description && (
                              <p className="mt-1 text-sm text-text-secondary">
                                {main.description}
                              </p>
                            )}
                            <p className="mt-2 text-xs text-text-muted">
                              {subs.length} sub-session
                              {subs.length === 1 ? "" : "s"}
                              {main.academic_year
                                ? ` · ${main.academic_year}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => openAddSubSession(main.id)}
                            >
                              <Plus className="size-4" />
                              Add Sub-session
                            </Button>
                            <button
                              type="button"
                              onClick={() => openEditMain(main)}
                              className="rounded p-2 text-text-muted hover:bg-gray-100"
                              aria-label={`Edit ${main.name}`}
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleMainExpanded(main.id)}
                              className="rounded p-2 text-text-muted hover:bg-gray-100"
                              aria-label={
                                expanded
                                  ? `Collapse ${main.name}`
                                  : `Expand ${main.name}`
                              }
                            >
                              {expanded ? (
                                <ChevronDown className="size-4" />
                              ) : (
                                <ChevronRight className="size-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {expanded && (
                          <div className="space-y-3 bg-surface-raised/40 p-4">
                            {subs.length === 0 ? (
                              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">
                                No sub-sessions yet. Add one to start taking
                                attendance under this main session.
                              </p>
                            ) : (
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {subs.map((session) => (
                                  <SessionCard
                                    key={session.id}
                                    session={session}
                                    nested
                                    isPending={isPending}
                                    onEdit={openEditSession}
                                    onView={setViewSession}
                                    onOpen={handleOpen}
                                    onClose={handleClose}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {filtered.standalones.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-text-secondary">
                  <Layers className="size-4" />
                  Standalone sessions
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filtered.standalones.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      isPending={isPending}
                      onEdit={openEditSession}
                      onView={setViewSession}
                      onOpen={handleOpen}
                      onClose={handleClose}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <Modal
        open={sessionModalMode !== null}
        onClose={closeSessionModal}
        title={
          isEditSession
            ? "Edit Session"
            : defaultMainSessionId
              ? "Add Sub-session"
              : "Add Session"
        }
        panelClassName="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={closeSessionModal}
              disabled={isPending}
              className="px-4 py-2 text-sm font-bold text-foreground disabled:opacity-60"
            >
              Cancel
            </button>
            {isEditSession && selectedSession && (
              <button
                type="button"
                onClick={() => handleArchiveSession(selectedSession.id)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-bold text-maroon disabled:opacity-60"
              >
                Archive
              </button>
            )}
            <button
              type="submit"
              form={sessionFormId}
              disabled={isPending}
              className="rounded bg-maroon px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {isPending
                ? "Saving..."
                : isEditSession
                  ? "Save Changes"
                  : "Add Session"}
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
          key={`${selectedSession?.id ?? "new"}-${defaultMainSessionId ?? "standalone"}`}
          formId={sessionFormId}
          session={selectedSession}
          checkers={checkers}
          mainSessions={mainSessions}
          defaultMainSessionId={defaultMainSessionId}
          lockOrganization={Boolean(defaultMainSessionId) && !isEditSession}
          onSubmit={handleSaveSession}
        />
      </Modal>

      <Modal
        open={mainModalMode !== null}
        onClose={closeMainModal}
        title={isEditMain ? "Edit Main Session" : "Add Main Session"}
        panelClassName="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={closeMainModal}
              disabled={isPending}
              className="px-4 py-2 text-sm font-bold text-foreground disabled:opacity-60"
            >
              Cancel
            </button>
            {isEditMain && selectedMain && (
              <button
                type="button"
                onClick={() => handleArchiveMain(selectedMain.id)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-bold text-maroon disabled:opacity-60"
              >
                Archive
              </button>
            )}
            <button
              type="submit"
              form={mainFormId}
              disabled={isPending}
              className="rounded bg-maroon px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {isPending
                ? "Saving..."
                : isEditMain
                  ? "Save Changes"
                  : "Add Main Session"}
            </button>
          </>
        }
      >
        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <MainSessionForm
          key={selectedMain?.id ?? "new-main"}
          formId={mainFormId}
          mainSession={selectedMain}
          onSubmit={handleSaveMain}
        />
      </Modal>

      <Modal
        open={viewSession !== null}
        onClose={() => setViewSession(null)}
        title={
          viewSession ? `${viewSession.title} — Attendance` : "Attendance"
        }
        panelClassName="max-w-4xl"
        footer={
          <button
            type="button"
            onClick={() => setViewSession(null)}
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
