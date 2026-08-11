import { redirect } from "next/navigation";
import { getPortalProfile } from "@/lib/auth";
import { AdminShell } from "@/components/layout/AdminShell";

export default async function AdminRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getPortalProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <AdminShell
      profile={{
        fullName: profile.full_name,
        email: profile.email,
        role: profile.role,
        department: profile.department ?? null,
        permissions: profile.permissions,
      }}
    >
      {children}
    </AdminShell>
  );
}
