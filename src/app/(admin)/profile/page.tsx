import { PageHeader } from "@/components/ui/PageHeader";
import { getPortalProfile } from "@/lib/auth";
import { ADMIN_ROLE } from "@/lib/constants";
import { ChangeEmailForm } from "./ChangeEmailForm";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function ProfilePage() {
  const profile = await getPortalProfile();
  const isSuperAdmin = profile?.role === ADMIN_ROLE;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Profile"
        description="Your AttendEase administration account"
      />

      <div className="card divide-y divide-border-subtle">
        <div className="grid gap-1 px-5 py-4 sm:grid-cols-[160px_1fr]">
          <p className="text-sm font-medium text-text-muted">Name</p>
          <p className="text-sm text-foreground">{profile?.full_name}</p>
        </div>
        <div className="grid gap-1 px-5 py-4 sm:grid-cols-[160px_1fr]">
          <p className="text-sm font-medium text-text-muted">Email</p>
          <p className="text-sm text-foreground">{profile?.email}</p>
        </div>
        <div className="grid gap-1 px-5 py-4 sm:grid-cols-[160px_1fr]">
          <p className="text-sm font-medium text-text-muted">Role</p>
          <p className="text-sm text-foreground">
            {isSuperAdmin ? "Super Admin" : "Department Admin"}
          </p>
        </div>
        {profile?.department && (
          <div className="grid gap-1 px-5 py-4 sm:grid-cols-[160px_1fr]">
            <p className="text-sm font-medium text-text-muted">Department</p>
            <p className="text-sm text-foreground">{profile.department}</p>
          </div>
        )}
        <div className="grid gap-1 px-5 py-4 sm:grid-cols-[160px_1fr]">
          <p className="text-sm font-medium text-text-muted">Status</p>
          <p className="text-sm capitalize text-foreground">{profile?.status}</p>
        </div>
      </div>

      {isSuperAdmin && profile?.email && (
        <ChangeEmailForm currentEmail={profile.email} />
      )}
      <ChangePasswordForm />
    </div>
  );
}
