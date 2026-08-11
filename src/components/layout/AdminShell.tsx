import { Sidebar } from "@/components/layout/Sidebar";
import type { PortalRole } from "@/lib/constants";
import type { PermissionKey } from "@/lib/permissions";

export type AdminShellProfile = {
  fullName: string;
  email: string;
  role: PortalRole;
  department: string | null;
  permissions: PermissionKey[];
};

type AdminShellProps = {
  children: React.ReactNode;
  profile: AdminShellProfile;
};

export function AdminShell({ children, profile }: AdminShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar profile={profile} />
      <div className="ml-60 flex min-h-screen flex-1 flex-col">
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
