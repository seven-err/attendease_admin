# Department Admin Test Matrix

How to create a test department admin and verify allow/deny behavior for portal modules, including direct API/RLS checks.

## 1) Create a test department admin

1. Sign in as a **super admin** (`users.role = admin`).
2. Open **Users** (`/users`).
3. Create a user with:
   - Role: `department_admin`
   - School + department (e.g. `CCS`)
   - Permissions: start from the default set, then customize for the case under test
4. Set a temporary password (or invite) and sign in as that user in a private/incognito window.

### Useful permission presets

| Preset | Grants | Intent |
| --- | --- | --- |
| Read-only ops | `people.view`, `qr.view`, `sessions.view`, `attendance.view`, `reports.view` | Browse only |
| QR operator | + `qr.generate`, `qr.export` (no `qr.regenerate`) | Can mint missing tokens, cannot rotate |
| Attendance editor | + `attendance.edit` (no `attendance.void`) | Correct logs, cannot void |
| Importer | `bulk_import.view`, `bulk_import.execute`, `people.create` | Run bulk CSV import |
| High-risk denied | Defaults without `*.archive`, `*.delete`, `qr.regenerate`, `attendance.void` | Confirm UI + server denies |

## 2) Module allow / deny cases

| Module | Route | Allow when | Deny / redirect when | Notes |
| --- | --- | --- | --- | --- |
| People | `/students` | `people.view` | Missing permission → nav hidden; mutations need create/edit/archive | RLS scopes academic records to assigned department |
| QR | `/qr` | `qr.view` | No `qr.view` → `/dashboard` | Generate needs `qr.generate`; regenerate needs `qr.regenerate` (confirm modal); export needs `qr.export` |
| Sessions | `/sessions` | `sessions.view` | Missing view permission | Create/edit/archive/delete map 1:1 to permission keys |
| Attendance | `/attendance` | `attendance.view` | No view → `/dashboard` | Edit/void/export gated by `attendance.edit` / `attendance.void` / `attendance.export` |
| Reports | `/reports` | `reports.view` | Missing view | Export needs `reports.export` |
| Bulk import | `/import` | `bulk_import.view` | No view → `/dashboard` | Execute needs `bulk_import.execute`; out-of-scope departments rejected |
| Audit log | `/audit` | Super admin **or** department admin | Non-portal roles | Dept admins only see their department (RLS). No fine-grained permission key |
| Schools & Depts | `/departments` | Super admin only | Dept admin never | Nav `superAdminOnly` |
| Users | `/users` | Super admin only | Dept admin never | |
| Settings | `/settings` | Super admin only | Dept admin never | |

## 3) Direct API / server-action checks

UI hiding is not enough. For each mutation, call the server action while signed in as the dept admin **without** the permission:

| Action | Required permission | Expected result without grant |
| --- | --- | --- |
| `regenerateQrToken` | `qr.regenerate` | `{ success: false, error: …permission… }` |
| `generateMissingQrTokens` | `qr.generate` | Denied |
| `exportQrCsv` | `qr.export` | Denied |
| `updateAttendanceLog` | `attendance.edit` | Denied |
| `voidAttendanceLog` | `attendance.void` | Denied |
| `exportSessionAttendanceCsv` | `attendance.export` | Denied |
| `executeBulkImport` | `bulk_import.execute` | Denied (view-only can still validate) |
| `fetchSessionAttendance` | `attendance.view` **or** `sessions.view` | Denied if neither |

Also verify **department scope**:

- QR regenerate / attendance export / bulk import for another department returns a scope/permission error even when the permission key is granted.
- Attempting to update `students` / `people` / `attendance_logs` outside the assigned department should fail under RLS (`person_in_user_department` / `can_access_department`).

## 4) RLS spot checks (SQL as the dept admin JWT)

Run with the department admin session (not the service role):

```sql
-- Should return only in-department academic/student rows
select count(*) from public.students;
select count(*) from public.student_academic_records;

-- Audit: only own department (or empty if none written)
select department, count(*) from public.admin_audit_logs group by 1;

-- Cross-department write should fail
update public.students
set full_name = full_name
where id in (
  select s.id
  from public.students s
  join public.student_academic_records r on r.student_id = s.id
  where r.department <> current_setting('request.jwt.claims', true)::json->>'department' -- illustrative
  limit 1
);
```

Prefer exercising through the app + server actions; use SQL only to confirm policy denials when debugging.

## 5) QR dual-write check

After generate/regenerate:

```sql
select s.id, s.qr_token = p.qr_token as synced
from public.students s
join public.people p on p.id = s.id
where s.id = '<student_uuid>';
```

`synced` must be `true`. Scanner reads `people.qr_token`.

## 6) Attendance void semantics

`attendance_logs.attendance_status` is constrained to `Present | Late | Absent` (no `Voided` value). Voiding updates the log to:

- `attendance_status = 'Absent'`
- `time_out_at = null`
- `device_id = '__voided__'` (UI sentinel → displays as Voided)

Dept admins cannot `DELETE` attendance logs (RLS); only super admins have a delete policy.

## 7) Audit coverage

High-risk and import/QR mutations should create `admin_audit_logs` rows with actor, action, target, department, and useful metadata. Confirm as both super admin (campus-wide) and dept admin (scoped list).
