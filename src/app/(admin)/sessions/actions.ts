"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getAdminProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  parseSessionForm,
  SessionActionResult,
  sessionPayloadFromInput,
  validateSessionForm,
} from "@/lib/validations/session";
import {
  getSessionAttendanceRoster,
  SessionAttendanceRow,
} from "@/lib/data/session-attendance";

export type SessionAttendanceResult =
  | { success: true; rows: SessionAttendanceRow[] }
  | { success: false; error: string };

async function requireAdmin(): Promise<SessionActionResult | null> {
  const profile = await getAdminProfile();
  if (!profile) {
    return { success: false, error: "Unauthorized. Admin access required." };
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

export async function createSession(
  formData: FormData
): Promise<SessionActionResult> {
  const authError = await requireAdmin();
  if (authError) return authError;

  const input = parseSessionForm(formData);
  const validationError = validateSessionForm(input);
  if (validationError) return validationError;

  const profile = await getAdminProfile();
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
  const authError = await requireAdmin();
  if (authError) return authError;
  if (!sessionId) {
    return { success: false, error: "Session ID is required." };
  }

  const input = parseSessionForm(formData);
  const validationError = validateSessionForm(input);
  if (validationError) return validationError;

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
  const authError = await requireAdmin();
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
  const authError = await requireAdmin();
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
  const authError = await requireAdmin();
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
  const profile = await getAdminProfile();
  if (!profile) {
    return { success: false, error: "Unauthorized. Admin access required." };
  }
  if (!sessionId) {
    return { success: false, error: "Session ID is required." };
  }

  const rows = await getSessionAttendanceRoster(sessionId);
  return { success: true, rows };
}
