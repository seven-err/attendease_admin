-- Efficient Present / Late / Late (Excused) / Absent counts for session cards.
-- Matches roster rules: active students whose latest academic record matches
-- the session department / course / year_level filters (null = unrestricted).
-- Unscoped sessions (no department/course/year_level) count from logs only
-- so previews are not zeroed and do not cross-join the full student body.
-- SECURITY DEFINER avoids RLS / large PostgREST .in() failures.

CREATE OR REPLACE FUNCTION public.get_scoped_session_counts(p_session_ids uuid[])
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
  WITH sessions AS (
    SELECT
      s.id,
      nullif(trim(s.department), '') AS department,
      nullif(trim(s.course), '') AS course,
      nullif(trim(s.year_level), '') AS year_level
    FROM public.attendance_sessions s
    WHERE s.id = ANY (p_session_ids)
  ),
  scoped_sessions AS (
    SELECT *
    FROM sessions
    WHERE department IS NOT NULL
       OR course IS NOT NULL
       OR year_level IS NOT NULL
  ),
  unscoped_sessions AS (
    SELECT id
    FROM sessions
    WHERE department IS NULL
      AND course IS NULL
      AND year_level IS NULL
  ),
  latest_academic AS (
    SELECT DISTINCT ON (r.student_id)
      r.student_id,
      r.department,
      r.course,
      r.year_level
    FROM public.student_academic_records r
    ORDER BY r.student_id, r.created_at DESC
  ),
  roster AS (
    SELECT
      se.id AS session_id,
      la.student_id
    FROM scoped_sessions se
    JOIN latest_academic la ON true
    JOIN public.students st
      ON st.id = la.student_id
     AND st.student_status = 'Active'
    WHERE (se.department IS NULL OR la.department = se.department)
      AND (se.course IS NULL OR la.course = se.course)
      AND (se.year_level IS NULL OR la.year_level = se.year_level)
  ),
  scoped_joined AS (
    SELECT
      r.session_id,
      r.student_id,
      l.scanned_at,
      l.attendance_status,
      l.device_id
    FROM roster r
    LEFT JOIN public.attendance_logs l
      ON l.session_id = r.session_id
     AND l.student_id = r.student_id
  ),
  scoped_counts AS (
    SELECT
      j.session_id,
      COUNT(*) FILTER (
        WHERE j.device_id IS DISTINCT FROM '__voided__'
          AND j.scanned_at IS NOT NULL
          AND j.attendance_status IS DISTINCT FROM 'Late'
          AND j.attendance_status IS DISTINCT FROM 'Late (Excused)'
      ) AS present_count,
      COUNT(*) FILTER (
        WHERE j.device_id IS DISTINCT FROM '__voided__'
          AND j.scanned_at IS NOT NULL
          AND j.attendance_status = 'Late'
      ) AS late_count,
      COUNT(*) FILTER (
        WHERE j.device_id IS DISTINCT FROM '__voided__'
          AND j.scanned_at IS NOT NULL
          AND j.attendance_status = 'Late (Excused)'
      ) AS late_excused_count,
      COUNT(*) FILTER (
        WHERE j.device_id = '__voided__'
          OR j.scanned_at IS NULL
      ) AS absent_count
    FROM scoped_joined j
    GROUP BY j.session_id
  ),
  unscoped_counts AS (
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
    FROM public.attendance_logs al
    JOIN unscoped_sessions us ON us.id = al.session_id
    GROUP BY al.session_id
  )
  SELECT * FROM scoped_counts
  UNION ALL
  SELECT * FROM unscoped_counts;
$$;

GRANT EXECUTE ON FUNCTION public.get_scoped_session_counts(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_scoped_session_counts(uuid[]) TO service_role;
