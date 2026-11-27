-- ============================================================================
-- OpEx Task Manager - Supabase Operational RPCs, SLA Alerts & Admin Helpers
-- ============================================================================
-- Run AFTER schema.sql in the Supabase SQL Editor.
-- Provides:
--   1. sync_deadline_notifications() -> emits due_soon & overdue_alert records
--   2. get_dashboard_kpis()          -> server-side KPI & SLA summary RPC
--   3. promote_user_role()           -> Admin / SQL Editor role promotion helper
--   4. Optional pg_cron schedule for automated hourly SLA / deadline checks
-- ============================================================================

-- 1. Automated Due Soon & Overdue Alert Generator (Deduplicated)
CREATE OR REPLACE FUNCTION public.sync_deadline_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created INTEGER := 0;
  v_row RECORD;
  v_recipient UUID;
BEGIN
  FOR v_row IN
    SELECT
      t.id,
      t.task_code,
      t.title,
      t.due_date,
      t.assignee_id,
      t.created_by,
      CASE
        WHEN t.due_date < CURRENT_DATE THEN 'overdue_alert'::public.notification_type
        ELSE 'due_soon'::public.notification_type
      END AS alert_type
    FROM public.tasks t
    WHERE t.status NOT IN ('Done', 'Cancelled')
      AND t.due_date IS NOT NULL
      AND t.due_date <= CURRENT_DATE + INTERVAL '2 days'
  LOOP
    v_recipient := COALESCE(v_row.assignee_id, v_row.created_by);

    IF NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = v_recipient
        AND n.task_id = v_row.id
        AND n.type = v_row.alert_type
        AND n.created_at >= NOW() - INTERVAL '7 days'
    ) THEN
      INSERT INTO public.notifications (user_id, task_id, type, title, message)
      VALUES (
        v_recipient,
        v_row.id,
        v_row.alert_type,
        CASE
          WHEN v_row.alert_type = 'overdue_alert' THEN 'Overdue Alert: ' || v_row.task_code
          ELSE 'Due Soon: ' || v_row.task_code
        END,
        CASE
          WHEN v_row.alert_type = 'overdue_alert'
            THEN '"' || v_row.title || '" is past its due date (' || v_row.due_date::TEXT || ').'
          ELSE '"' || v_row.title || '" is due on ' || v_row.due_date::TEXT || '.'
        END
      );
      v_created := v_created + 1;
    END IF;
  END LOOP;

  RETURN v_created;
END;
$$;

-- 2. Dashboard KPI & SLA Monitoring RPC (respects caller RLS via security_invoker)
CREATE OR REPLACE FUNCTION public.get_dashboard_kpis()
RETURNS TABLE (
  total_tasks INTEGER,
  open_tasks INTEGER,
  in_progress_tasks INTEGER,
  review_tasks INTEGER,
  completed_tasks INTEGER,
  cancelled_tasks INTEGER,
  overdue_tasks INTEGER,
  due_soon_tasks INTEGER,
  sla_breached INTEGER,
  sla_at_risk INTEGER,
  completion_rate INTEGER,
  sla_compliance_rate INTEGER,
  avg_age_hours INTEGER
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::INTEGER AS total_tasks,
    COUNT(*) FILTER (WHERE status = 'Open')::INTEGER AS open_tasks,
    COUNT(*) FILTER (WHERE status = 'In Progress')::INTEGER AS in_progress_tasks,
    COUNT(*) FILTER (WHERE status = 'Review')::INTEGER AS review_tasks,
    COUNT(*) FILTER (WHERE status = 'Done')::INTEGER AS completed_tasks,
    COUNT(*) FILTER (WHERE status = 'Cancelled')::INTEGER AS cancelled_tasks,
    COUNT(*) FILTER (WHERE due_state = 'Overdue')::INTEGER AS overdue_tasks,
    COUNT(*) FILTER (WHERE due_state = 'Due Soon')::INTEGER AS due_soon_tasks,
    COUNT(*) FILTER (WHERE sla_status = 'Breached')::INTEGER AS sla_breached,
    COUNT(*) FILTER (WHERE sla_status = 'At Risk')::INTEGER AS sla_at_risk,
    COALESCE(
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE status = 'Done')
        / NULLIF(COUNT(*) FILTER (WHERE status <> 'Cancelled'), 0)
      )::INTEGER,
      0
    ) AS completion_rate,
    COALESCE(
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE status <> 'Cancelled' AND sla_status <> 'Breached')
        / NULLIF(COUNT(*) FILTER (WHERE status <> 'Cancelled'), 0)
      )::INTEGER,
      100
    ) AS sla_compliance_rate,
    COALESCE(
      ROUND(AVG(age_hours) FILTER (WHERE status NOT IN ('Done', 'Cancelled')))::INTEGER,
      0
    ) AS avg_age_hours
  FROM public.v_task_sla_aging;
$$;

-- 3. Admin Role Promotion Helper (usable by Supabase SQL Editor or Admin RPC)
CREATE OR REPLACE FUNCTION public.promote_user_role(
  p_email TEXT,
  p_role public.user_role
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow execution from SQL Editor (auth.uid() IS NULL) or by an active Admin
  IF auth.uid() IS NOT NULL AND public.current_user_role() <> 'Admin' THEN
    RAISE EXCEPTION 'Only Admins can change user roles.';
  END IF;

  UPDATE public.profiles
  SET role = p_role
  WHERE LOWER(email) = LOWER(p_email);
END;
$$;

-- 4. Optional: Schedule hourly deadline & SLA alerts with pg_cron in Supabase
-- Enable the pg_cron extension under Database -> Extensions, then run:
--
-- SELECT cron.schedule(
--   'opex-hourly-sla-deadline-alerts',
--   '0 * * * *',
--   $$SELECT public.sync_deadline_notifications();$$
-- );
