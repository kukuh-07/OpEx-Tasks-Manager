-- ============================================================================
-- OpEx Task Manager - Sample Test Data (PostgreSQL / Supabase Seed Script)
-- ============================================================================
-- Run AFTER schema.sql and AFTER creating users in Supabase Auth (or run via
-- Supabase SQL Editor using the fixed UUIDs below for local testing).
-- ============================================================================

DO $$
DECLARE
  v_admin_id      UUID := '11111111-1111-4111-8111-111111111101';
  v_supervisor_id UUID := '11111111-1111-4111-8111-111111111102';
  v_member_1_id   UUID := '11111111-1111-4111-8111-111111111103';
  v_member_2_id   UUID := '11111111-1111-4111-8111-111111111104';
  v_member_3_id   UUID := '11111111-1111-4111-8111-111111111105';

  v_task_1 UUID := '22222222-2222-4222-8222-222222222201';
  v_task_2 UUID := '22222222-2222-4222-8222-222222222202';
  v_task_3 UUID := '22222222-2222-4222-8222-222222222203';
  v_task_4 UUID := '22222222-2222-4222-8222-222222222204';
  v_task_5 UUID := '22222222-2222-4222-8222-222222222205';
  v_task_6 UUID := '22222222-2222-4222-8222-222222222206';
  v_comment_1 UUID := '33333333-3333-4333-8333-333333333301';
BEGIN
  -- Sample Profiles with Area / Branch / Outlet assignments
  INSERT INTO public.profiles (id, email, full_name, role, status, department, job_title, area, branch, outlet)
  VALUES
    (v_admin_id,      'elena.vance@opex.local',   'Elena Vance',   'Admin',      'Active',   'Operations Control', 'VP of Operational Excellence', 'Region West',    'North Hub Branch',      'Outlet 01 - Flagship Plaza'),
    (v_supervisor_id, 'marcus.chen@opex.local',   'Marcus Chen',   'Supervisor', 'Active',   'Plant Logistics',    'Operations Supervisor',        'Region West',    'West Logistics Branch', 'Warehouse Bay A'),
    (v_member_1_id,   'priya.nair@opex.local',    'Priya Nair',    'Member',     'Active',   'Quality Assurance',  'QA Process Analyst',           'Region Central', 'Central Metro Branch',  'Outlet 04 - Harbor Bay'),
    (v_member_2_id,   'daniel.ortiz@opex.local',  'Daniel Ortiz',  'Member',     'Active',   'Facility Fleet',     'Reliability Engineer',         'Region East',    'East Coast Branch',     'Outlet 07 - Midtown Station'),
    (v_member_3_id,   'hana.sato@opex.local',     'Hana Sato',     'Member',     'Inactive', 'Supply Chain',       'Inventory Coordinator',        'Region Central', 'South Retail Branch',   'Outlet 12 - Airport Terminal')
  ON CONFLICT (id) DO NOTHING;

  -- Link Area Region Leads
  UPDATE public.areas SET region_lead_id = v_supervisor_id WHERE name = 'Region West';
  UPDATE public.areas SET region_lead_id = v_admin_id WHERE name = 'Region Central';

  -- Sample Excel Import Batch
  INSERT INTO public.task_import_batches (id, imported_by, file_name, total_rows, imported_rows, failed_rows, status)
  VALUES (
    '44444444-4444-4444-8444-444444444401',
    v_admin_id,
    'q4-operational-rollout.xlsx',
    6,
    6,
    0,
    'Completed'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Sample Operational Tasks with Category, Area, Branch, Outlet, and SLA Hours
  INSERT INTO public.tasks (id, task_code, title, description, category, priority, status, department, area, branch, outlet, sla_hours, due_date, assignee_id, created_by, import_batch_id)
  VALUES
    (v_task_1, 'OPX-101', 'Q4 Cold-Chain Sensor Calibration Audit',
      'Verify thermal logger calibration certificates across bays A1-A6 and upload signed PDF compliance packets.',
      'Compliance & Audit', 'Critical', 'In Progress', 'Quality Assurance', 'Region West', 'North Hub Branch', 'Warehouse Bay A', 24,
      CURRENT_DATE - INTERVAL '2 days', v_member_1_id, v_admin_id, '44444444-4444-4444-8444-444444444401'),
    (v_task_2, 'OPX-102', 'Dock 4 Automated Conveyor Preventive Maintenance',
      'Inspect belt tension, replace worn drive rollers, and verify emergency stop interlock response under load.',
      'Preventive Maintenance', 'High', 'Review', 'Facility Fleet', 'Region West', 'West Logistics Branch', 'Cold Storage Bay B', 48,
      CURRENT_DATE + INTERVAL '1 day', v_member_2_id, v_supervisor_id, NULL),
    (v_task_3, 'OPX-103', 'Monthly Inbound Freight Variance Reconciliation',
      'Cross-check carrier billing manifests against warehouse receiving logs and export discrepancy workbook.',
      'Logistics & Fleet', 'Medium', 'Open', 'Plant Logistics', 'Region Central', 'Central Metro Branch', 'Outlet 04 - Harbor Bay', 72,
      CURRENT_DATE + INTERVAL '4 days', v_supervisor_id, v_admin_id, NULL),
    (v_task_4, 'OPX-104', 'Standard Operating Procedure Rev 4.2 Sign-Off',
      'Update lockout/tagout checklists for packaging line 3 and distribute final SOP to shift leads.',
      'Safety & HSE', 'High', 'Done', 'Operations Control', 'Region East', 'East Coast Branch', 'Outlet 07 - Midtown Station', 48,
      CURRENT_DATE - INTERVAL '5 days', v_member_1_id, v_supervisor_id, NULL),
    (v_task_5, 'OPX-105', 'Backup Generator Load-Bank Test Protocol',
      'Schedule 2-hour 80% load test with electrical contractor and log fuel consumption telemetry.',
      'Facility Repair', 'Low', 'Open', 'Facility Fleet', 'Region West', 'North Hub Branch', 'Outlet 01 - Flagship Plaza', 120,
      CURRENT_DATE + INTERVAL '9 days', v_member_2_id, v_admin_id, NULL),
    (v_task_6, 'OPX-106', 'Legacy Pallet Scanner Decommission',
      'Retire old handheld RF units in Zone C following migration to new barcode terminals.',
      'IT & POS Support', 'Low', 'Cancelled', 'Supply Chain', 'Region Central', 'South Retail Branch', 'Outlet 12 - Airport Terminal', 120,
      CURRENT_DATE - INTERVAL '1 day', v_member_3_id, v_supervisor_id, NULL)
  ON CONFLICT (id) DO NOTHING;

  -- Sample Comment & Threaded Reply
  INSERT INTO public.task_comments (id, task_id, author_id, parent_id, body)
  VALUES
    (v_comment_1, v_task_1, v_supervisor_id, NULL, 'Bays A1 through A4 passed verification. Waiting on A5 probe certificate from vendor.'),
    ('33333333-3333-4333-8333-333333333302', v_task_1, v_member_1_id, v_comment_1, 'Vendor confirmed A5 certificate will arrive by 14:00 today; I will attach the PDF immediately.')
  ON CONFLICT (id) DO NOTHING;

  -- Sample Notifications
  INSERT INTO public.notifications (user_id, task_id, type, title, message, is_read)
  VALUES
    (v_member_1_id, v_task_1, 'task_assigned', 'Task Assigned: OPX-101', 'You were assigned to "Q4 Cold-Chain Sensor Calibration Audit".', FALSE),
    (v_member_1_id, v_task_1, 'overdue_alert', 'Overdue Alert: OPX-101', 'OPX-101 is past its due date and SLA window.', FALSE),
    (v_member_2_id, v_task_2, 'due_soon', 'Due Soon: OPX-102', 'OPX-102 is due within 24 hours.', FALSE),
    (v_supervisor_id, v_task_2, 'task_updated', 'Task Updated: OPX-102', 'Daniel Ortiz moved OPX-102 to Review.', FALSE),
    (v_admin_id, v_task_4, 'task_completed', 'Task Completed: OPX-104', 'Priya Nair marked OPX-104 as Done.', TRUE)
  ON CONFLICT DO NOTHING;
END $$;
