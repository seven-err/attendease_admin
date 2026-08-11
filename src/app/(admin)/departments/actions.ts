"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/admin/audit";
import { requireSuperAdmin, type PortalProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type OrgActionResult =
  | { success: true }
  | { success: false; error: string };

async function assertSuperAdmin(): Promise<
  { profile: PortalProfile } | { error: OrgActionResult }
> {
  try {
    return { profile: await requireSuperAdmin() };
  } catch {
    return {
      error: { success: false, error: "Only super admins can manage schools and departments." },
    };
  }
}

export async function createSchool(formData: FormData): Promise<OrgActionResult> {
  const auth = await assertSuperAdmin();
  if ("error" in auth) return auth.error;
  const { profile } = auth;

  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!code || !name) {
    return { success: false, error: "School code and name are required." };
  }
  if (!/^\d+$/.test(code)) {
    return { success: false, error: "School / org code must be a number (e.g. 001)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("schools").insert({
    code,
    name,
    description,
    status: "active",
  });
  if (error) return { success: false, error: error.message };

  await writeAuditLog(profile, {
    action: "school.create",
    targetType: "school",
    targetId: code,
    metadata: { name, description },
  });

  revalidatePath("/departments");
  return { success: true };
}

export async function updateSchool(formData: FormData): Promise<OrgActionResult> {
  const auth = await assertSuperAdmin();
  if ("error" in auth) return auth.error;
  const { profile } = auth;

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!id || !name) return { success: false, error: "Missing school fields." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("schools")
    .update({ name, description, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { success: false, error: error.message };

  await writeAuditLog(profile, {
    action: "school.update",
    targetType: "school",
    targetId: id,
    metadata: { name, description },
  });

  revalidatePath("/departments");
  return { success: true };
}

export async function setSchoolStatus(
  id: string,
  status: "active" | "archived"
): Promise<OrgActionResult> {
  const auth = await assertSuperAdmin();
  if ("error" in auth) return auth.error;
  const { profile } = auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("schools")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { success: false, error: error.message };

  await writeAuditLog(profile, {
    action: status === "archived" ? "school.archive" : "school.restore",
    targetType: "school",
    targetId: id,
    metadata: { status },
  });

  revalidatePath("/departments");
  return { success: true };
}

export async function createDepartment(
  formData: FormData
): Promise<OrgActionResult> {
  const auth = await assertSuperAdmin();
  if ("error" in auth) return auth.error;
  const { profile } = auth;

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const schoolId = String(formData.get("school_id") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!code || !name || !schoolId) {
    return { success: false, error: "Code, name, and school are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("departments").insert({
    code,
    name,
    school_id: schoolId,
    description,
    status: "active",
  });
  if (error) return { success: false, error: error.message };

  await writeAuditLog(profile, {
    action: "department.create",
    targetType: "department",
    targetId: code,
    department: code,
    metadata: { name, schoolId },
  });

  revalidatePath("/departments");
  return { success: true };
}

export async function updateDepartment(
  formData: FormData
): Promise<OrgActionResult> {
  const auth = await assertSuperAdmin();
  if ("error" in auth) return auth.error;
  const { profile } = auth;

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const schoolId = String(formData.get("school_id") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!code || !name || !schoolId) {
    return { success: false, error: "Missing department fields." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("departments")
    .update({
      name,
      school_id: schoolId,
      description,
      updated_at: new Date().toISOString(),
    })
    .eq("code", code);
  if (error) return { success: false, error: error.message };

  await writeAuditLog(profile, {
    action: "department.update",
    targetType: "department",
    targetId: code,
    department: code,
    metadata: { name, schoolId },
  });

  revalidatePath("/departments");
  return { success: true };
}

export async function setDepartmentStatus(
  code: string,
  status: "active" | "inactive" | "archived"
): Promise<OrgActionResult> {
  const auth = await assertSuperAdmin();
  if ("error" in auth) return auth.error;
  const { profile } = auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("departments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("code", code);
  if (error) return { success: false, error: error.message };

  await writeAuditLog(profile, {
    action:
      status === "archived"
        ? "department.archive"
        : status === "active"
          ? "department.restore"
          : "department.deactivate",
    targetType: "department",
    targetId: code,
    department: code,
    metadata: { status },
  });

  revalidatePath("/departments");
  return { success: true };
}
