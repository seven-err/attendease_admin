import { AdminShell, type AdminShellProfile } from "@/components/layout/AdminShell";

type AdminLayoutProps = {
  children: React.ReactNode;
  profile: AdminShellProfile;
};

/** @deprecated Prefer AdminShell via (admin)/layout. */
export function AdminLayout({ children, profile }: AdminLayoutProps) {
  return <AdminShell profile={profile}>{children}</AdminShell>;
}
