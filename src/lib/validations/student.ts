import {
  STUDENT_STATUSES,
  StudentFormInput,
  StudentStatus,
} from "@/lib/attendeaseTypes";
import { DEPARTMENTS } from "@/lib/constants";

export type StudentActionResult =
  | { success: true }
  | { success: false; error: string };

function isStudentStatus(value: string): value is StudentStatus {
  return (STUDENT_STATUSES as readonly string[]).includes(value);
}

export function parseStudentForm(formData: FormData): StudentFormInput {
  const status = String(formData.get("student_status") ?? "Active");
  return {
    student_number: String(formData.get("student_number") ?? "").trim(),
    full_name: String(formData.get("full_name") ?? "").trim(),
    student_status: isStudentStatus(status) ? status : "Active",
    department: String(formData.get("department") ?? "").trim(),
    course: String(formData.get("course") ?? "").trim(),
    year_level: String(formData.get("year_level") ?? "").trim(),
    academic_year: String(formData.get("academic_year") ?? "").trim(),
  };
}

export function validateStudentForm(
  input: StudentFormInput
): StudentActionResult | null {
  if (!input.student_number) {
    return { success: false, error: "Student number is required." };
  }
  if (!input.full_name) {
    return { success: false, error: "Full name is required." };
  }
  if (!isStudentStatus(input.student_status)) {
    return { success: false, error: "Invalid student status." };
  }
  if (!input.department) {
    return { success: false, error: "Department is required." };
  }
  if (!(DEPARTMENTS as readonly string[]).includes(input.department)) {
    return { success: false, error: "Invalid department." };
  }
  if (!input.course) {
    return { success: false, error: "Course is required." };
  }
  if (!input.year_level) {
    return { success: false, error: "Year level is required." };
  }
  return null;
}

export function currentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startYear = month >= 6 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}
