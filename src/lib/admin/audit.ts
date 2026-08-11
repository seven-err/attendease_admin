import { createClient } from "@/lib/supabase/server";
import type { PortalProfile } from "@/lib/auth";
import { scopedDepartment } from "@/lib/permissions";

export type AuditLogInput = {
  action: string;
  targetType?: string;
  targetId?: string;
  department?: string | null;
  schoolId?: string | null;
  metadata?: Record<string, unknown>;
};

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  department: string | null;
  school_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ListAuditLogsParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  action?: string;
};

export async function writeAuditLog(
  profile: PortalProfile,
  input: AuditLogInput
): Promise<void> {
  const supabase = await createClient();
  const department =
    input.department ?? scopedDepartment(profile) ?? profile.department ?? null;

  const { error } = await supabase.from("admin_audit_logs").insert({
    actor_id: profile.id,
    action: input.action,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    department,
    school_id: input.schoolId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error("Failed to write audit log:", error.message);
  }
}

export async function listAuditLogs(
  params: ListAuditLogsParams = {}
): Promise<{
  items: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("admin_audit_logs")
    .select(
      "id, actor_id, action, target_type, target_id, department, school_id, metadata, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  const search = params.search?.trim();
  if (search) {
    query = query.or(
      `action.ilike.%${search}%,target_type.ilike.%${search}%,target_id.ilike.%${search}%,department.ilike.%${search}%`
    );
  }

  if (params.action?.trim()) {
    query = query.eq("action", params.action.trim());
  }

  const { data, error, count } = await query.range(from, to);
  if (error || !data) {
    console.error("listAuditLogs failed:", error?.message);
    return { items: [], total: 0, page, pageSize, totalPages: 1 };
  }

  const actorIds = [
    ...new Set(
      data.map((row) => row.actor_id).filter((id): id is string => Boolean(id))
    ),
  ];

  const actorMap = new Map<
    string,
    { full_name: string; email: string | null }
  >();
  if (actorIds.length) {
    const { data: actors } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("id", actorIds);
    for (const actor of actors ?? []) {
      actorMap.set(actor.id, {
        full_name: actor.full_name,
        email: actor.email,
      });
    }
  }

  const items: AuditLogRow[] = data.map((row) => {
    const actor = row.actor_id ? actorMap.get(row.actor_id) : undefined;
    return {
      id: row.id,
      actor_id: row.actor_id,
      actor_name: actor?.full_name ?? null,
      actor_email: actor?.email ?? null,
      action: row.action,
      target_type: row.target_type,
      target_id: row.target_id,
      department: row.department,
      school_id: row.school_id,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      created_at: row.created_at,
    };
  });

  const total = count ?? 0;
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
