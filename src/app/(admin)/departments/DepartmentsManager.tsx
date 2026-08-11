"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionEditor } from "@/components/permissions/PermissionEditor";
import type { DepartmentRow, SchoolRow } from "@/lib/data/organization";
import type { PortalUserRow } from "@/lib/data/users";
import { DEPARTMENT_ADMIN_ROLE } from "@/lib/constants";
import {
  DEFAULT_DEPARTMENT_ADMIN_PERMISSIONS,
  type PermissionKey,
} from "@/lib/permissions";
import {
  createDepartment,
  createSchool,
  setDepartmentStatus,
  setSchoolStatus,
  updateDepartment,
  updateSchool,
} from "./actions";
import { updateDepartmentAdminPermissions } from "@/app/(admin)/users/actions";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  RotateCcw,
  Shield,
} from "lucide-react";

type DepartmentsManagerProps = {
  schools: SchoolRow[];
  departments: DepartmentRow[];
  departmentAdmins: PortalUserRow[];
};

export function DepartmentsManager({
  schools,
  departments,
  departmentAdmins,
}: DepartmentsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [deptModal, setDeptModal] = useState<"create" | "edit" | null>(null);
  const [schoolModal, setSchoolModal] = useState<"create" | "edit" | null>(null);
  const [permModalUser, setPermModalUser] = useState<PortalUserRow | null>(null);
  const [selectedDept, setSelectedDept] = useState<DepartmentRow | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<SchoolRow | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolDescription, setSchoolDescription] = useState("");
  const [permissions, setPermissions] = useState<PermissionKey[]>([
    ...DEFAULT_DEPARTMENT_ADMIN_PERMISSIONS,
  ]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const adminsByDept = useMemo(() => {
    const map = new Map<string, PortalUserRow[]>();
    for (const admin of departmentAdmins) {
      if (!admin.department) continue;
      const list = map.get(admin.department) ?? [];
      list.push(admin);
      map.set(admin.department, list);
    }
    return map;
  }, [departmentAdmins]);

  const departmentsBySchool = useMemo(() => {
    const map = new Map<string, DepartmentRow[]>();
    for (const dept of departments) {
      const list = map.get(dept.school_id) ?? [];
      list.push(dept);
      map.set(dept.school_id, list);
    }
    return map;
  }, [departments]);

  function openCreateDept(forSchoolId?: string) {
    setSelectedDept(null);
    setDeptModal("create");
    setCode("");
    setName("");
    setSchoolId(
      forSchoolId ??
        schools.find((s) => s.status === "active")?.id ??
        ""
    );
    setDescription("");
    setError(null);
  }

  function openEditDept(dept: DepartmentRow) {
    setSelectedDept(dept);
    setDeptModal("edit");
    setCode(dept.code);
    setName(dept.name);
    setSchoolId(dept.school_id);
    setDescription(dept.description ?? "");
    setError(null);
  }

  function openCreateSchool() {
    setSelectedSchool(null);
    setSchoolModal("create");
    const used = new Set(
      schools
        .map((s) => Number.parseInt(s.code, 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    );
    let next = 1;
    while (used.has(next)) next += 1;
    setSchoolCode(String(next).padStart(3, "0"));
    setSchoolName("");
    setSchoolDescription("");
    setError(null);
  }

  function openEditSchool(school: SchoolRow) {
    setSelectedSchool(school);
    setSchoolModal("edit");
    setSchoolCode(school.code);
    setSchoolName(school.name);
    setSchoolDescription(school.description ?? "");
    setError(null);
  }

  function submitDepartment() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("code", code);
      formData.set("name", name);
      formData.set("school_id", schoolId);
      formData.set("description", description);
      const result =
        deptModal === "edit"
          ? await updateDepartment(formData)
          : await createDepartment(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(
        deptModal === "edit" ? "Department updated." : "Department created."
      );
      setDeptModal(null);
      router.refresh();
    });
  }

  function submitSchool() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("code", schoolCode);
      formData.set("name", schoolName);
      formData.set("description", schoolDescription);
      if (schoolModal === "edit" && selectedSchool) {
        formData.set("id", selectedSchool.id);
      }
      const result =
        schoolModal === "edit"
          ? await updateSchool(formData)
          : await createSchool(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(schoolModal === "edit" ? "School updated." : "School created.");
      setSchoolModal(null);
      setSelectedSchool(null);
      setSchoolCode("");
      setSchoolName("");
      setSchoolDescription("");
      router.refresh();
    });
  }

  function openPermissions(admin: PortalUserRow) {
    setPermModalUser(admin);
    setPermissions(
      admin.permissions.length
        ? admin.permissions
        : [...DEFAULT_DEPARTMENT_ADMIN_PERMISSIONS]
    );
    setError(null);
  }

  function savePermissions() {
    if (!permModalUser) return;
    setError(null);
    startTransition(async () => {
      const result = await updateDepartmentAdminPermissions(
        permModalUser.id,
        permissions
      );
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(`Permissions updated for ${permModalUser.full_name}.`);
      setPermModalUser(null);
      router.refresh();
    });
  }

  function toggleSchool(schoolIdValue: string) {
    setCollapsed((prev) => ({
      ...prev,
      [schoolIdValue]: !prev[schoolIdValue],
    }));
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Schools & Orgs"
        description="Schools and organizations with their departments nested inside"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openCreateSchool}
            >
              <Plus className="size-4" />
              Add school / org
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openCreateDept()}
              disabled={schools.filter((s) => s.status === "active").length === 0}
            >
              <Plus className="size-4" />
              Add department
            </button>
          </div>
        }
      />

      {(error || success) && (
        <div
          className={
            error
              ? "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              : "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          }
        >
          {error ?? success}
        </div>
      )}

      {schools.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-10 text-center text-sm text-text-secondary">
          No schools or organizations yet. Create one to start adding
          departments.
        </div>
      ) : (
        <div className="space-y-4">
          {schools.map((school) => {
            const schoolDepts = departmentsBySchool.get(school.id) ?? [];
            const isCollapsed = Boolean(collapsed[school.id]);

            return (
              <section
                key={school.id}
                className="overflow-hidden rounded-xl border border-border bg-surface"
              >
                <div className="flex flex-wrap items-start gap-3 border-b border-border-subtle bg-surface-raised px-4 py-3">
                  <button
                    type="button"
                    className="mt-0.5 rounded p-1 text-text-muted hover:bg-white/60"
                    onClick={() => toggleSchool(school.id)}
                    aria-label={
                      isCollapsed
                        ? `Expand ${school.name}`
                        : `Collapse ${school.name}`
                    }
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-text-primary">
                        {school.name}
                      </h3>
                      <span className="font-mono text-xs text-text-muted">
                        {school.code}
                      </span>
                      <Badge>{school.status}</Badge>
                    </div>
                    {school.description && (
                      <p className="mt-1 text-sm text-text-secondary">
                        {school.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-text-muted">
                      {schoolDepts.length} department
                      {schoolDepts.length === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => openCreateDept(school.id)}
                      disabled={school.status !== "active"}
                    >
                      <Plus className="size-4" />
                      Department
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      title="Edit school / org"
                      onClick={() => openEditSchool(school)}
                    >
                      <Pencil className="size-4" />
                    </button>
                    {school.status === "archived" ? (
                      <button
                        type="button"
                        className="btn-icon"
                        title="Restore"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            await setSchoolStatus(school.id, "active");
                            router.refresh();
                          })
                        }
                      >
                        <RotateCcw className="size-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-icon"
                        title="Archive"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            await setSchoolStatus(school.id, "archived");
                            router.refresh();
                          })
                        }
                      >
                        <Archive className="size-4" />
                      </button>
                    )}
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    {schoolDepts.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-text-muted">
                        No departments in this school / org yet.
                      </p>
                    ) : (
                      <table className="min-w-full text-left text-sm">
                        <thead className="border-b border-border-subtle text-xs uppercase tracking-wide text-text-muted">
                          <tr>
                            <th className="px-4 py-3">Code</th>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Stats</th>
                            <th className="px-4 py-3">Admins</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schoolDepts.map((dept) => {
                            const admins = adminsByDept.get(dept.code) ?? [];
                            return (
                              <tr
                                key={dept.code}
                                className="border-b border-border-subtle align-top last:border-b-0"
                              >
                                <td className="px-4 py-3 font-semibold">
                                  {dept.code}
                                </td>
                                <td className="px-4 py-3">
                                  <p>{dept.name}</p>
                                  {dept.description && (
                                    <p className="text-xs text-text-muted">
                                      {dept.description}
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-xs text-text-secondary">
                                  <div>{dept.student_count ?? 0} people</div>
                                  <div>
                                    {dept.checker_count ?? 0} checkers
                                  </div>
                                  <div>{dept.admin_count ?? 0} admins</div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="space-y-1">
                                    {admins.map((admin) => (
                                      <button
                                        key={admin.id}
                                        type="button"
                                        className="flex items-center gap-1 text-left text-xs font-medium text-maroon hover:underline"
                                        onClick={() => openPermissions(admin)}
                                        title="Configure permissions"
                                      >
                                        <Shield className="size-3.5" />
                                        {admin.full_name}
                                      </button>
                                    ))}
                                    {admins.length === 0 && (
                                      <span className="text-xs text-text-muted">
                                        None assigned
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge>{dept.status}</Badge>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      className="btn-icon"
                                      title="Edit department"
                                      onClick={() => openEditDept(dept)}
                                    >
                                      <Pencil className="size-4" />
                                    </button>
                                    {dept.status === "archived" ? (
                                      <button
                                        type="button"
                                        className="btn-icon"
                                        title="Restore"
                                        disabled={isPending}
                                        onClick={() =>
                                          startTransition(async () => {
                                            await setDepartmentStatus(
                                              dept.code,
                                              "active"
                                            );
                                            router.refresh();
                                          })
                                        }
                                      >
                                        <RotateCcw className="size-4" />
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className="btn-icon"
                                        title="Archive"
                                        disabled={isPending}
                                        onClick={() =>
                                          startTransition(async () => {
                                            await setDepartmentStatus(
                                              dept.code,
                                              "archived"
                                            );
                                            router.refresh();
                                          })
                                        }
                                      >
                                        <Archive className="size-4" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Modal
        open={deptModal !== null}
        onClose={() => setDeptModal(null)}
        title={deptModal === "edit" ? "Edit department" : "Add department"}
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setDeptModal(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isPending}
              onClick={submitDepartment}
            >
              {isPending ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="label-field">Code</span>
            <input
              className="input-field"
              value={code}
              disabled={deptModal === "edit"}
              placeholder="e.g. CCS"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </label>
          <label className="block">
            <span className="label-field">Name</span>
            <input
              className="input-field"
              value={name}
              placeholder="e.g. College of Computer Studies"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="label-field">School / org</span>
            <select
              className="select-field w-full"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
            >
              {schools
                .filter(
                  (s) => s.status === "active" || s.id === selectedDept?.school_id
                )
                .map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name} ({school.code})
                  </option>
                ))}
            </select>
          </label>
          <label className="block">
            <span className="label-field">Description</span>
            <textarea
              className="input-field min-h-24 h-auto py-2"
              value={description}
              placeholder="Optional notes about this department"
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={schoolModal !== null}
        onClose={() => setSchoolModal(null)}
        title={
          schoolModal === "edit" ? "Edit school / org" : "Add school / org"
        }
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSchoolModal(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isPending}
              onClick={submitSchool}
            >
              {isPending
                ? "Saving..."
                : schoolModal === "edit"
                  ? "Save"
                  : "Create"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="label-field">Code</span>
            <input
              className="input-field font-mono"
              value={schoolCode}
              disabled={schoolModal === "edit"}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="e.g. 001"
              onChange={(e) =>
                setSchoolCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
            <span className="mt-1 block text-xs text-text-muted">
              Numeric campus / org ID (e.g. 001).
            </span>
          </label>
          <label className="block">
            <span className="label-field">Name</span>
            <input
              className="input-field"
              value={schoolName}
              placeholder="e.g. CRMC"
              onChange={(e) => setSchoolName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="label-field">Description</span>
            <textarea
              className="input-field min-h-24 h-auto py-2"
              value={schoolDescription}
              placeholder="Optional notes about this school / org"
              onChange={(e) => setSchoolDescription(e.target.value)}
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={permModalUser !== null}
        onClose={() => setPermModalUser(null)}
        title={`Permissions · ${permModalUser?.full_name ?? ""}`}
        panelClassName="max-w-3xl"
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPermModalUser(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isPending}
              onClick={savePermissions}
            >
              {isPending ? "Saving..." : "Save permissions"}
            </button>
          </>
        }
      >
        {permModalUser?.role === DEPARTMENT_ADMIN_ROLE && (
          <p className="mb-3 text-sm text-text-secondary">
            Department: <strong>{permModalUser.department}</strong>
          </p>
        )}
        <PermissionEditor value={permissions} onChange={setPermissions} />
      </Modal>
    </div>
  );
}
