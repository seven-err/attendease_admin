import { redirect } from "next/navigation";
import { getPortalProfile } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/permissions";
import {
  listDepartmentsDetailed,
  listSchools,
} from "@/lib/data/organization";
import { listPortalUsers } from "@/lib/data/users";
import { DepartmentsManager } from "./DepartmentsManager";

export default async function DepartmentsPage() {
  const profile = await getPortalProfile();
  if (!isSuperAdmin(profile)) {
    redirect("/dashboard");
  }

  const [schools, departments, users] = await Promise.all([
    listSchools(true),
    listDepartmentsDetailed(),
    listPortalUsers(),
  ]);

  return (
    <DepartmentsManager
      schools={schools}
      departments={departments}
      departmentAdmins={users.filter((u) => u.role === "department_admin")}
    />
  );
}
