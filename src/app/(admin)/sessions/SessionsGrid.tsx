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
  ExportModeModal,
  type ExportModeSelection,
} from "@/components/reports/ExportModeModal";
import {
  MainSession,
  SESSION_STATUSES,
  SessionWithStats,
} from "@/lib/attendeaseTypes";
import { DEPARTMENTS } from "@/lib/constants";
import { SessionCheckerOption } from "@/lib/data/checkers";
import { organizeSessions } from "@/lib/data/session-organization";
import { downloadCsv } from "@/lib/export-attendance";
import {
  FALLBACK_POLL_MS,
  useAttendanceRealtime,
  usePollingFallback,
} from "@/lib/hooks/useAttendanceRealtime";
import {
  displaySessionStatus,
  formatDate,
  formatTimeRange,
  sessionStatusVariant,
} from "@/lib/format";
import { exportMainSessionAttendanceCsv } from "@/app/(admin)/attendance/actions";
import { formatPenaltyRatesSummary } from "@/lib/penalties";
import {
  archiveMainSession,
  archiveSession,
  closeSession,
  createMainSession,
  createSession,
  deleteMainSession,
  deleteSession,
  openSession,
  updateMainSession,
  updateSession,
} from "./actions";
import { SESSION_DELETE_CONFIRMATION } from "@/lib/validations/session";
import { MainSessionForm } from "./MainSessionForm";
import { SessionForm } from "./SessionForm";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
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
  canExport?: boolean;
  canDelete?: boolean;
  scopedDepartment?: string | null;
};

type PendingDelete =
  | {
      kind: "session";
      id: string;
      name: string;
      isSubSession: boolean;
    }
  | {
      kind: "main";
      id: string;
      name: string;
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

function SessionCardStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-0 rounded border border-border-subtle bg-white/60 px-2 py-1.5">
      <p className="truncate text-[11px] font-bold uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <p className="truncate text-sm font-bold tabular-nums">{value}</p>
    </div>
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
  const attendees =
    session.present_count + session.late_count + session.late_excused_count;
  const lateTotal = session.late_count + session.late_excused_count;

  return (
    <div
      className={
        nested
          ? "flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface-raised"
          : "flex h-full min-w-0 flex-col overflow-hidden rounded-[10px] border border-border bg-white"
      }
    >
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap gap-2">
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
            className="shrink-0 rounded p-1 text-text-muted hover:bg-gray-100"
            aria-label={`Edit ${session.title}`}
          >
            <Pencil className="size-4" />
          </button>
        </div>
        <h3 className="mb-1 break-words text-lg font-bold">{session.title}</h3>
        {session.main_session_name && (
          <p className="mb-3 break-words text-xs text-text-muted">
            Under {session.main_session_name}
          </p>
        )}
        <div className="space-y-2 text-sm text-text-secondary">
          <p className="flex min-w-0 items-center gap-2">
            <Calendar className="size-4 shrink-0" />
            <span className="min-w-0 break-words">
              {formatDate(session.date)}
            </span>
          </p>
          <p className="flex min-w-0 items-center gap-2">
            <Clock className="size-4 shrink-0" />
            <span className="min-w-0 break-words">
              {formatTimeRange(session.start_time, session.end_time)}
            </span>
          </p>
          <p className="flex min-w-0 items-center gap-2">
            <User className="size-4 shrink-0" />
            <span className="min-w-0 break-words">
              {session.checker_name ?? "Unassigned"}
            </span>
          </p>
          <p className="text-xs text-text-muted">
            {formatPenaltyRatesSummary({
              latePhp: session.penalty_late_php,
              absentPhp: session.penalty_absent_php,
              incompletePhp: session.penalty_incomplete_php,
            })}
          </p>
        </div>
        <div className="mt-auto pt-3">
          {(session.status === "Open" ||
            session.status === "Closed" ||
            session.status === "Archived") && (
            <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
              <SessionCardStat label="Attendees" value={attendees} />
              <SessionCardStat label="Present" value={session.present_count} />
              <SessionCardStat label="Late" value={lateTotal} />
              <SessionCardStat label="Absent" value={session.absent_count} />
            </div>
          )}
          {session.status === "Draft" && (
            <p className="flex items-start gap-1 text-xs text-text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>Assign a checker before opening.</span>
            </p>
          )}
        </div>
      </div>
      <div className="grid min-h-[3.25rem] grid-cols-1 gap-2 border-t border-border bg-surface-raised px-3 py-3 min-[360px]:grid-cols-2 min-[360px]:px-4">
        {session.status === "Draft" && (
          <>
            <Button
              variant="outline-brand"
              onClick={() => onEdit(session)}
              className="min-w-0 w-full"
            >
              Edit
            </Button>
            <Button
              disabled={isPending}
              onClick={() => onOpen(session.id)}
              className="min-w-0 w-full"
            >
              Open
            </Button>
          </>
        )}
        {session.status === "Open" && (
          <>
            <Button
              variant="outline-brand"
              onClick={() => onView(session)}
              className="min-w-0 w-full"
            >
              <Eye className="size-4 shrink-0" />
              <span className="truncate">View Details</span>
            </Button>
            <Button
              disabled={isPending}
              onClick={() => onClose(session.id)}
              className="min-w-0 w-full"
            >
              <span className="truncate">Close Session</span>
            </Button>
          </>
        )}
        {(session.status === "Closed" || session.status === "Archived") && (
          <Button
            variant="outline-brand"
            onClick={() => onView(session)}
            className="min-w-0 w-full min-[360px]:col-span-2"
          >
            <Eye className="size-4 shrink-0" />
            <span className="truncate">View Details</span>
          </Button>
        )}
      </div>
    </div>
  );
}

export function SessionsGrid({
  sessions,
  mainSessions,
  checkers,
  canExport = false,
  canDelete = false,
  scopedDepartment = null,
}: SessionsGridProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState(
    scopedDepartment ?? "all"
  );
  const deptOptions = scopedDepartment
    ? [scopedDepartment]
    : [...DEPARTMENTS];
  const [organizationFilter, setOrganizationFilter] =
    useState<OrganizationFilter>("all");
  const [expandedMains, setExpandedMains] = useState<Set<string>>(
    () => new Set()
  );

  const [sessionModalMode, setSessionModalMode] =
    useState<SessionModalMode>(null);
  const [mainModalMode, setMainModalMode] = useState<MainModalMode>(null);
  const [viewSession, setViewSession] = useState<SessionWithStats | null>(null);
  const [selectedSession, setSelectedSession] =
    useState<SessionWithStats | null>(null);
  const [selectedMain, setSelectedMain] = useState<MainSession | null>(null);
  const [exportMain, setExportMain] = useState<MainSession | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null
  );
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [defaultMainSessionId, setDefaultMainSessionId] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refreshSessions = useCallback(() => {
    router.refresh();
  }, [router]);

  const { realtimeReady } = useAttendanceRealtime(refreshSessions);
  usePollingFallback(refreshSessions, realtimeReady === false, FALLBACK_POLL_MS);

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

  function openDeleteSession(session: SessionWithStats) {
    setError(null);
    setDeleteConfirmation("");
    setPendingDelete({
      kind: "session",
      id: session.id,
      name: session.title,
      isSubSession: Boolean(session.main_session_id),
    });
  }

  function openDeleteMain(main: MainSession) {
    setError(null);
    setDeleteConfirmation("");
    setPendingDelete({
      kind: "main",
      id: main.id,
      name: main.name,
    });
  }

  function closeDeleteModal() {
    if (isPending) return;
    setPendingDelete(null);
    setDeleteConfirmation("");
    setError(null);
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return;
    setError(null);
    startTransition(async () => {
      const result =
        pendingDelete.kind === "session"
          ? await deleteSession(pendingDelete.id, deleteConfirmation)
          : await deleteMainSession(pendingDelete.id, deleteConfirmation);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setPendingDelete(null);
      setDeleteConfirmation("");
      if (pendingDelete.kind === "session") {
        closeSessionModal();
        setViewSession((current) =>
          current?.id === pendingDelete.id ? null : current
        );
        setSuccess(
          pendingDelete.isSubSession
            ? "Sub-session deleted permanently."
            : "Session deleted permanently."
        );
      } else {
        closeMainModal();
        setSuccess(
          "Main session deleted. Sub-sessions were left unchanged and now appear as standalone."
        );
      }
      router.refresh();
    });
  }

  const deletePhraseMatches =
    deleteConfirmation.trim() === SESSION_DELETE_CONFIRMATION;

  async function handleExportMain({
    mode,
    summaryColumns,
  }: ExportModeSelection): Promise<boolean> {
    if (!exportMain) return false;
    setError(null);
    const result = await exportMainSessionAttendanceCsv(
      exportMain.id,
      mode,
      summaryColumns
    );
    if (!result.success) {
      setError(result.error);
      return false;
    }
    downloadCsv(result.filename, result.csv);
    setSuccess(
      mode === "summary"
        ? `Summary exported for ${exportMain.name}.`
        : `Attendance exported for ${exportMain.name}.`
    );
    return true;
  }

  const sessionFormId = "session-form";
  const mainFormId = "main-session-form";
  const isEditSession = sessionModalMode === "edit";
  const isEditMain = mainModalMode === "edit";
  const hasResults =
    filtered.mainGroups.length > 0 || filtered.standalones.length > 0;
  const exportSubCount = exportMain
    ? (organized.mainGroups.find((group) => group.main.id === exportMain.id)
        ?.subs.length ?? 0)
    : 0;

  return (
    <>
      {success && (
        <Alert
          variant="success"
          onDismiss={() => setSuccess(null)}
          className="mx-auto mb-4 min-w-0 max-w-7xl"
        >
          {success}
        </Alert>
      )}
      {!sessionModalMode && !mainModalMode && !pendingDelete && error && (
        <Alert
          variant="error"
          onDismiss={() => setError(null)}
          className="mx-auto mb-4 min-w-0 max-w-7xl"
        >
          {error}
        </Alert>
      )}

      <div className="mx-auto min-w-0 max-w-7xl space-y-4">
        <PageHeader
          title="Attendance Sessions"
          description="Organize events as main sessions with sub-sessions, or as standalone sessions"
          actions={
            <>
              <Button
                variant="secondary"
                onClick={openAddMain}
                className="min-w-0 max-sm:flex-1"
              >
                <FolderTree className="size-4 shrink-0" />
                <span className="truncate">Add Main Session</span>
              </Button>
              <Button onClick={openAddStandalone} className="min-w-0 max-sm:flex-1">
                <Plus className="size-4 shrink-0" />
                <span className="truncate">Add Session</span>
              </Button>
            </>
          }
        />

        <div className="grid gap-4 rounded-[10px] border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
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

          <div className="min-w-0">
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

          <div className="min-w-0">
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

          <div className="min-w-0">
            <label className="mb-1 block text-[11px] font-bold uppercase text-text-secondary">
              Department
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-10 w-full rounded border border-border px-3 text-sm"
              disabled={Boolean(scopedDepartment)}
            >
              {!scopedDepartment && (
                <option value="all">All departments</option>
              )}
              {deptOptions.map((dept) => (
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
                        <div className="flex flex-col gap-3 border-b border-border px-3 py-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:px-4">
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
                            <h3 className="break-words text-lg font-bold">
                              {main.name}
                            </h3>
                            {main.description && (
                              <p className="mt-1 break-words text-sm text-text-secondary">
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
                            <p className="mt-1 text-xs text-text-muted">
                              {formatPenaltyRatesSummary({
                                latePhp: main.penalty_late_php,
                                absentPhp: main.penalty_absent_php,
                                incompletePhp: main.penalty_incomplete_php,
                              })}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {canExport && (
                              <Button
                                variant="secondary"
                                onClick={() => setExportMain(main)}
                                disabled={isPending || subs.length === 0}
                                className="min-w-0"
                              >
                                <Download className="size-4 shrink-0" />
                                Export
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              onClick={() => openAddSubSession(main.id)}
                              className="min-w-0"
                            >
                              <Plus className="size-4 shrink-0" />
                              <span className="truncate">Add Sub-session</span>
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
                          <div className="space-y-3 bg-surface-raised/40 p-3 sm:p-4">
                            {subs.length === 0 ? (
                              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">
                                No sub-sessions yet. Add one to start taking
                                attendance under this main session.
                              </p>
                            ) : (
                              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

      <ExportModeModal
        open={exportMain !== null}
        onClose={() => !isPending && setExportMain(null)}
        onExport={handleExportMain}
        disabled={exportSubCount === 0}
        title={
          exportMain
            ? `Export ${exportMain.name}`
            : "Export Main Session"
        }
        description={
          exportMain
            ? `Export attendance across all ${exportSubCount} sub-session${exportSubCount === 1 ? "" : "s"} under this main session.`
            : "Choose detailed roster rows or a per-student status summary."
        }
        summaryDescription="One row per student with the status counts you select, plus Total Sessions across all sub-sessions."
      />

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
            {canDelete && isEditSession && selectedSession && (
              <button
                type="button"
                onClick={() => openDeleteSession(selectedSession)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-60"
              >
                Delete
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
          lockedDepartment={scopedDepartment}
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
            {canDelete && isEditMain && selectedMain && (
              <button
                type="button"
                onClick={() => openDeleteMain(selectedMain)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-60"
              >
                Delete
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
          lockedDepartment={scopedDepartment}
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
            mainSessionName={viewSession.main_session_name}
            sessionPenalties={{
              status: viewSession.status,
              date: viewSession.date,
              start_time: viewSession.start_time,
              end_time: viewSession.end_time,
              time_in_start: viewSession.time_in_start,
              time_in_end: viewSession.time_in_end,
              time_out_start: viewSession.time_out_start,
              time_out_end: viewSession.time_out_end,
              penalty_late_php: viewSession.penalty_late_php,
              penalty_absent_php: viewSession.penalty_absent_php,
              penalty_incomplete_php: viewSession.penalty_incomplete_php,
            }}
          />
        )}
      </Modal>

      <Modal
        open={pendingDelete !== null}
        onClose={closeDeleteModal}
        title={
          pendingDelete?.kind === "main"
            ? "Delete Main Session"
            : pendingDelete?.isSubSession
              ? "Delete Sub-session"
              : "Delete Session"
        }
        panelClassName="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={closeDeleteModal}
              disabled={isPending}
              className="px-4 py-2 text-sm font-bold text-foreground disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isPending || !deletePhraseMatches}
              className="rounded bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {isPending ? "Deleting..." : "Delete permanently"}
            </button>
          </>
        }
      >
        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="space-y-4 text-sm text-text-secondary">
          <p>
            You are about to delete{" "}
            <span className="font-bold text-foreground">
              {pendingDelete?.name}
            </span>
            .
          </p>
          {pendingDelete?.kind === "session" ? (
            <p>
              This permanently removes the{" "}
              {pendingDelete.isSubSession ? "sub-session" : "session"} and all of
              its attendance records. This cannot be undone.
            </p>
          ) : (
            <p>
              This removes the main session from the list. Sub-sessions are left
              unchanged and will appear as standalone sessions.
            </p>
          )}
          <div>
            <label
              htmlFor="session-delete-confirmation"
              className="mb-1 block text-[11px] font-bold uppercase text-text-secondary"
            >
              Type{" "}
              <span className="normal-case tracking-normal text-foreground">
                {SESSION_DELETE_CONFIRMATION}
              </span>{" "}
              to continue
            </label>
            <input
              id="session-delete-confirmation"
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={isPending}
              placeholder={SESSION_DELETE_CONFIRMATION}
              className="h-10 w-full rounded border border-border px-3 text-sm outline-none focus:border-maroon"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
