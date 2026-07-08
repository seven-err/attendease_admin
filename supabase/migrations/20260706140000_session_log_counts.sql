-- Aggregates attendance log counts per session in one query.
-- Apply via Supabase SQL editor or `supabase db push`.

CREATE OR REPLACE FUNCTION public.get_session_log_counts(p_session_ids uuid[])
RETURNS TABLE(
  session_id uuid,
  present_count bigint,
  late_count bigint,
  absent_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    al.session_id,
    COUNT(*) FILTER (WHERE al.attendance_status = 'Present') AS present_count,
    COUNT(*) FILTER (WHERE al.attendance_status = 'Late') AS late_count,
    COUNT(*) FILTER (WHERE al.attendance_status = 'Absent') AS absent_count
  FROM attendance_logs al
  WHERE al.session_id = ANY(p_session_ids)
  GROUP BY al.session_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_log_counts(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_session_log_counts(uuid[]) TO service_role;
