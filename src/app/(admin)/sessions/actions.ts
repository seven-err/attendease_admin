"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getPortalProfile } from "@/lib/auth";
import { can, canAny, scopedDepartment, type PermissionKey } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  parseSessionForm,
  SessionActionResult,
  sessionPayloadFromInput,
  validateSessionForm,
} from "@/lib/validations/session";
import {
  mainSessionPayloadFromInput,
  parseMainSessionForm,
  validateMainSessionForm,
} from "@/lib/validations/main-session";
import { getSessionAttendanceRoster } from "@/lib/data/session-attendance";
import type { SessionAttendanceRow } from "@/lib/attendeaseTypes";

export type SessionAttendanceResult =
  | { success: true; rows: SessionAttendanceRow[] }
  | { success: false; error: string };

async function requireSessionPermission(
  permission: PermissionKey | PermissionKey[]
): Promise<SessionActionResult | null> {
  const profile = await getPortalProfile();
  const allowed = Array.isArray(permission)
    ? canAny(profile, permission)
    : can(profile, permission);
  if (!profile || !allowed) {
    return {
      success: false,
      error: "You don't have permission to manage sessions.",
    };
  }
  return null;
}

async function enforceSessionDepartment(
  department: string | null | undefined
): Promise<string | null> {
  const profile = await getPortalProfile();
  const scope = scopedDepartment(profile);
  if (!scope) return null;
  if (!department || department !== scope) {
    return "You can only manage sessions for your assigned department.";
  }
  return null;
}

function revalidateSessionPaths() {
  revalidatePath("/sessions");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidateTag("dashboard-stats", "max");
  revalidateTag("report-stats", "max");
}

async function assertMainSessionAccessible(
  mainSessionId: string
): Promise<SessionActionResult | null> {
  const supabase = await createClient();
  const { data: main, error } = await supabase
    .from("main_sessions")
    .select("id, department, status")
    .eq("id", mainSessionId)
    .maybeSingle();

  if (error || !main) {
    return {
      success: false,
      error: error?.message ?? "Main session not found.",
    };
  }
  if (main.status === "Trashed") {
    return {
      success: false,
      error: "Cannot attach sessions to a trashed main session.",
    };
  }

  const scopeError = await enforceSessionDepartment(main.department);
  if (scopeError) return { success: false, error: scopeError };

  return null;
}

export async function createMainSession(
  formData: FormData
): Promise<SessionActionResult> {
  const authError = await requireSessionPermission("sessions.create");
  if (authError) return authError;

  const input = parseMainSessionForm(formData);
  const validationError = validateMainSessionForm(input);
  if (validationError) return validationError;

  const scopeError = await enforceSessionDepartment(input.department);
  if (scopeError) return { success: false, error: scopeError };

  const profile = await getPortalProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("main_sessions")
    .insert(mainSessionPayloadFromInput(input, profile?.id ?? null));

  if (error) {
    return {
      success: false,
      error: error.message ?? "Failed to create main session.",
    };
  }

  revalidateSessionPaths();
  return { success: true };
}

export async function updateMainSession(
  mainSessionId: string,
  formData: FormData
): Promise<SessionActionResult> {
  const authError = await requireSessionPermission("sessions.edit");
  if (authError) return authError;
  if (!mainSessionId) {
    return { success: false, error: "Main session ID is required." };
  }

  const input = parseMainSessionForm(formData);
  const validationError = validateMainSessionForm(input);
  if (validationError) return validationError;

  const scopeError = await enforceSessionDepartment(input.department);
  if (scopeError) return { success: false, error: scopeError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("main_sessions")
    .update(mainSessionPayloadFromInput(input))
    .eq("id", mainSessionId);

  if (error) {
    return {
      success: false,
      error: error.message ?? "Failed to update main session.",
    };
  }

  revalidateSessionPaths();
  return { success: true };
}

export async function archiveMainSession(
  mainSessionId: string
): Promise<SessionActionResult> {
  const authError = await requireSessionPermission("sessions.archive");
  if (authError) return authError;
  if (!mainSessionId) {
    return { success: false, error: "Main session ID is required." };
  }

  const supabase = await createClient();
  const { data: main, error: getError } = await supabase
    .from("main_sessions")
    .select("department, status")
    .eq("id", mainSessionId)
    .maybeSingle();

  if (getError || !main) {
    return {
      success: false,
      error: getError?.message ?? "Main session not found.",
    };
  }

  const scopeError = await enforceSessionDepartment(main.department);
  if (scopeError) return { success: false, error: scopeError };

  const { error } = await supabase
    .from("main_sessions")
    .update({
      status: "Archived",
      pre_archive_status: main.status === "Archived" ? null : main.status,
    })
    .eq("id", mainSessionId);

  if (error) {
    return {
      success: false,
      error: error.message ?? "Failed to archive main session.",
    };
  }

  revalidateSessionPaths();
  return { success: true };
}

export async function createSession(
  formData: FormData
): Promise<SessionActionResult> {
  const authError = await requireSessionPermission("sessions.create");
  if (authError) return authError;

  const input = parseSessionForm(formData);
  const validationError = validateSessionForm(input);
  if (validationError) return validationError;

  const scopeError = await enforceSessionDepartment(input.department);
  if (scopeError) return { success: false, error: scopeError };

  if (input.main_session_id) {
    const mainError = await assertMainSessionAccessible(input.main_session_id);
    if (mainError) return mainError;
  }

  const profile = await getPortalProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("attendance_sessions")
    .insert(sessionPayloadFromInput(input, profile?.id ?? null));

  if (error) {
    return {
      success: false,
      error: error.message ?? "Failed to create session.",
    };
  }

  revalidateSessionPaths();
  return { success: true };
}

export async function updateSession(
  sessionId: string,
  formData: FormData
): Promise<SessionActionResult> {
  const authError = await requireSessionPermission("sessions.edit");
  if (authError) return authError;
  if (!sessionId) {
    return { success: false, error: "Session ID is required." };
  }

  const input = parseSessionForm(formData);
  const validationError = validateSessionForm(input);
  if (validationError) return validationError;

  const scopeError = await enforceSessionDepartment(input.department);
  if (scopeError) return { success: false, error: scopeError };

  if (input.main_session_id) {
    const mainError = await assertMainSessionAccessible(input.main_session_id);
    if (mainError) return mainError;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_sessions")
    .update(sessionPayloadFromInput(input))
    .eq("id", sessionId);

  if (error) {
    return {
      success: false,
      error: error.message ?? "Failed to update session.",
    };
  }

  revalidateSessionPaths();
  return { success: true };
}

export async function closeSession(
  sessionId: string
): Promise<SessionActionResult> {
  const authError = await requireSessionPermission("sessions.edit");
  if (authError) return authError;
  if (!sessionId) {
    return { success: false, error: "Session ID is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_sessions")
    .update({ status: "Closed" })
    .eq("id", sessionId);

  if (error) {
    return {
      success: false,
      error: error.message ?? "Failed to close session.",
    };
  }

  revalidateSessionPaths();
  return { success: true };
}

export async function openSession(
  sessionId: string
): Promise<SessionActionResult> {
  const authError = await requireSessionPermission("sessions.edit");
  if (authError) return authError;
  if (!sessionId) {
    return { success: false, error: "Session ID is required." };
  }

  const supabase = await createClient();
  const { data: session, error: getError } = await supabase
    .from("attendance_sessions")
    .select("assigned_checker_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (getError || !session) {
    return {
      success: false,
      error: getError?.message ?? "Session not found.",
    };
  }

  if (!session.assigned_checker_id) {
    return {
      success: false,
      error: "Assign a checker before opening the session.",
    };
  }

  const { error } = await supabase
    .from("attendance_sessions")
    .update({ status: "Open" })
    .eq("id", sessionId);

  if (error) {
    return {
      success: false,
      error: error.message ?? "Failed to open session.",
    };
  }

  revalidateSessionPaths();
  return { success: true };
}

export async function archiveSession(
  sessionId: string
): Promise<SessionActionResult> {
  const authError = await requireSessionPermission("sessions.archive");
  if (authError) return authError;
  if (!sessionId) {
    return { success: false, error: "Session ID is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_sessions")
    .update({ status: "Archived" })
    .eq("id", sessionId);

  if (error) {
    return {
      success: false,
      error: error.message ?? "Failed to archive session.",
    };
  }

  revalidateSessionPaths();
  return { success: true };
}

export async function fetchSessionAttendance(
  sessionId: string
): Promise<SessionAttendanceResult> {
  const profile = await getPortalProfile();
  if (!profile || !canAny(profile, ["attendance.view", "sessions.view"])) {
    return { success: false, error: "Unauthorized. Admin access required." };
  }
  if (!sessionId) {
    return { success: false, error: "Session ID is required." };
  }

  const rows = await getSessionAttendanceRoster(sessionId);
  return { success: true, rows };
}
