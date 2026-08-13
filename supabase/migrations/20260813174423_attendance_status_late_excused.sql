-- Allow Late (Excused) on attendance_logs and align session log counts
-- with resolveAttendanceStatus (Present includes timed-in without time-out).

ALTER TABLE public.attendance_logs
  DROP CONSTRAINT IF EXISTS attendance_logs_attendance_status_check;

ALTER TABLE public.attendance_logs
  ADD CONSTRAINT attendance_logs_attendance_status_check
  CHECK (
    attendance_status = ANY (
      ARRAY[
        'Present'::text,
        'Late'::text,
        'Late (Excused)'::text,
        'Absent'::text
      ]
    )
  );

-- Return shape changed (added late_excused_count); replace function entirely.
DROP FUNCTION IF EXISTS public.get_session_log_counts(uuid[]);

CREATE FUNCTION public.get_session_log_counts(p_session_ids uuid[])
RETURNS TABLE(
  session_id uuid,
  present_count bigint,
  late_count bigint,
  late_excused_count bigint,
  absent_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    al.session_id,
    COUNT(*) FILTER (
      WHERE al.device_id IS DISTINCT FROM '__voided__'
        AND al.scanned_at IS NOT NULL
        AND al.attendance_status IS DISTINCT FROM 'Late'
        AND al.attendance_status IS DISTINCT FROM 'Late (Excused)'
    ) AS present_count,
    COUNT(*) FILTER (
      WHERE al.device_id IS DISTINCT FROM '__voided__'
        AND al.scanned_at IS NOT NULL
        AND al.attendance_status = 'Late'
    ) AS late_count,
    COUNT(*) FILTER (
      WHERE al.device_id IS DISTINCT FROM '__voided__'
        AND al.scanned_at IS NOT NULL
        AND al.attendance_status = 'Late (Excused)'
    ) AS late_excused_count,
    COUNT(*) FILTER (
      WHERE al.device_id IS DISTINCT FROM '__voided__'
        AND al.scanned_at IS NULL
    ) AS absent_count
  FROM attendance_logs al
  WHERE al.session_id = ANY(p_session_ids)
  GROUP BY al.session_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_log_counts(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_session_log_counts(uuid[]) TO service_role;
