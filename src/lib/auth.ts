import { ADMIN_ROLE } from "@/lib/constants";
import { AppUserProfile } from "@/lib/attendeaseTypes";
import { createClient } from "@/lib/supabase/server";

export async function getAdminProfile(): Promise<AppUserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, role, status")
    .eq("id", user.id)
    .eq("role", ADMIN_ROLE)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    full_name: data.full_name,
    email: data.email ?? user.email ?? "",
    role: ADMIN_ROLE,
    status: data.status,
  };
}
