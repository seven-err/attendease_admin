import {
  MainSessionStatus,
  MAIN_SESSION_STATUSES,
} from "@/lib/attendeaseTypes";
import { DEPARTMENTS } from "@/lib/constants";
import { parsePenaltyFormFields } from "@/lib/penalties";
import { currentAcademicYear } from "@/lib/validations/student";
import type { SessionActionResult } from "@/lib/validations/session";

export type MainSessionFormInput = {
  name: string;
  description: string;
  department: string;
  academic_year: string;
  status: MainSessionStatus;
  penalty_late_php: string;
  penalty_absent_php: string;
  penalty_incomplete_php: string;
};

function isMainSessionStatus(value: string): value is MainSessionStatus {
  return (MAIN_SESSION_STATUSES as readonly string[]).includes(value);
}

export function parseMainSessionForm(formData: FormData): MainSessionFormInput {
  const status = String(formData.get("status") ?? "Active");
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    department: String(formData.get("department") ?? "").trim(),
    academic_year: String(formData.get("academic_year") ?? "").trim(),
    status: isMainSessionStatus(status) ? status : "Active",
    penalty_late_php: String(formData.get("penalty_late_php") ?? ""),
    penalty_absent_php: String(formData.get("penalty_absent_php") ?? ""),
    penalty_incomplete_php: String(formData.get("penalty_incomplete_php") ?? ""),
  };
}

export function validateMainSessionForm(
  input: MainSessionFormInput
): SessionActionResult | null {
  if (!input.name) {
    return { success: false, error: "Main session name is required." };
  }
  if (!input.department) {
    return { success: false, error: "Department is required." };
  }
  if (!(DEPARTMENTS as readonly string[]).includes(input.department)) {
    return { success: false, error: "Invalid department." };
  }
  if (!isMainSessionStatus(input.status) || input.status === "Trashed") {
    return { success: false, error: "Invalid main session status." };
  }
  const penalties = parsePenaltyFormFields({
    late: input.penalty_late_php,
    absent: input.penalty_absent_php,
    incomplete: input.penalty_incomplete_php,
  });
  if (!penalties.ok) return { success: false, error: penalties.error };
  return null;
}

export function resolvedMainSessionPenalties(input: MainSessionFormInput): {
  penalty_late_php: number;
  penalty_absent_php: number;
  penalty_incomplete_php: number;
} {
  const parsed = parsePenaltyFormFields({
    late: input.penalty_late_php,
    absent: input.penalty_absent_php,
    incomplete: input.penalty_incomplete_php,
  });
  if (!parsed.ok) {
    return {
      penalty_late_php: 0,
      penalty_absent_php: 0,
      penalty_incomplete_php: 0,
    };
  }
  return {
    penalty_late_php: parsed.late,
    penalty_absent_php: parsed.absent,
    penalty_incomplete_php: parsed.incomplete,
  };
}

export function mainSessionPayloadFromInput(
  input: MainSessionFormInput,
  createdBy?: string | null
) {
  return {
    name: input.name,
    description: input.description || null,
    department: input.department,
    academic_year: input.academic_year || currentAcademicYear(),
    status: input.status,
    ...resolvedMainSessionPenalties(input),
    ...(createdBy ? { created_by: createdBy } : {}),
  };
}
