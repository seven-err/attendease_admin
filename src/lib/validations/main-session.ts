import {
  MainSessionStatus,
  MAIN_SESSION_STATUSES,
} from "@/lib/attendeaseTypes";
import { DEPARTMENTS } from "@/lib/constants";
import { currentAcademicYear } from "@/lib/validations/student";
import type { SessionActionResult } from "@/lib/validations/session";

export type MainSessionFormInput = {
  name: string;
  description: string;
  department: string;
  academic_year: string;
  status: MainSessionStatus;
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
  return null;
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
    ...(createdBy ? { created_by: createdBy } : {}),
  };
}
