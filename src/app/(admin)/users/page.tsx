import { redirect } from "next/navigation";
import { getPortalProfile } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/permissions";
import { listPortalUsers } from "@/lib/data/users";
import {
  listDepartmentsDetailed,
  listSchools,
} from "@/lib/data/organization";
import { UsersManager } from "./UsersManager";

export default async function UsersPage() {
  const profile = await getPortalProfile();
  if (!isSuperAdmin(profile)) {
    redirect("/dashboard");
  }

  const [users, schools, departments] = await Promise.all([
    listPortalUsers(),
    listSchools(true),
    listDepartmentsDetailed(),
  ]);

  return (
    <UsersManager
      users={users}
      schools={schools}
      departments={departments}
    />
  );
}
