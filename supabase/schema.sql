-- ============================================================================
-- OpEx Task Manager - Complete PostgreSQL / Supabase Relational Schema
-- ============================================================================
-- Architecture:
--   User -> Vercel -> React App -> Supabase Auth -> PostgreSQL -> Storage
--
-- Tables (11) & Relationships:
--   1.  public.areas               (1:N -> branches, 1:N -> profiles/tasks)
--   2.  public.branches            (N:1 -> areas, 1:N -> outlets, 1:N -> profiles/tasks)
--   3.  public.outlets             (N:1 -> branches, 1:N -> profiles/tasks)
--   4.  public.task_categories     (1:N -> tasks)
--   5.  public.profiles            (1:1 -> auth.users, N:1 -> areas/branches/outlets)
--   6.  public.task_import_batches (N:1 -> profiles)
--   7.  public.tasks               (N:1 -> task_categories/areas/branches/outlets/profiles/task_import_batches)
--   8.  public.task_attachments    (N:1 -> tasks, N:1 -> profiles, maps to storage.objects)
--   9.  public.task_comments       (N:1 -> tasks, N:1 -> profiles, self-ref parent_id -> task_comments)
--   10. public.task_activity_logs  (N:1 -> tasks, N:1 -> profiles)
--   11. public.notifications       (N:1 -> profiles, N:1 -> tasks)
--
-- Views:
--   - public.v_task_sla_aging      (Live SLA status, aging hours/days & buckets)
--   - public.v_user_productivity   (Completion rate, SLA compliance & ranking)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. CUSTOM ENUM TYPES
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('Admin', 'Supervisor', 'Member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.user_status AS ENUM ('Active', 'Inactive', 'Suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('Low', 'Medium', 'High', 'Critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('Open', 'In Progress', 'Review', 'Done', 'Cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
    'task_assigned',
    'task_updated',
    'task_completed',
    'comment_added',
    'due_soon',
    'overdue_alert'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'due_soon';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'overdue_alert';

-- ----------------------------------------------------------------------------
-- 2. ORGANIZATIONAL & CATEGORY MASTER TABLES
-- ----------------------------------------------------------------------------

-- Operational Areas / Regions
CREATE TABLE IF NOT EXISTS public.areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Operational Branches (belong to an Area)
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE RESTRICT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Operational Outlets / Sites (belong to a Branch)
CREATE TABLE IF NOT EXISTS public.outlets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Operational Task Categories with Default SLA Target
CREATE TABLE IF NOT EXISTS public.task_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  default_sla_hours INTEGER NOT NULL DEFAULT 72 CHECK (default_sla_hours BETWEEN 1 AND 8760),
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. CORE IDENTITY, TASK EXECUTION & COLLABORATION TABLES
-- ----------------------------------------------------------------------------

-- Profiles (1:1 with Supabase auth.users, linked to Area/Branch/Outlet)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'Member',
  status public.user_status NOT NULL DEFAULT 'Active',
  department TEXT NOT NULL DEFAULT 'Operations Control',
  job_title TEXT NOT NULL DEFAULT 'Operations Specialist',
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
  area TEXT NOT NULL DEFAULT 'Region West',
  branch TEXT NOT NULL DEFAULT 'North Hub Branch',
  outlet TEXT NOT NULL DEFAULT 'Outlet 01 - Flagship Plaza',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS area TEXT NOT NULL DEFAULT 'Region West';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch TEXT NOT NULL DEFAULT 'North Hub Branch';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS outlet TEXT NOT NULL DEFAULT 'Outlet 01 - Flagship Plaza';

-- Optional regional lead FK on areas (added after profiles exists)
ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS region_lead_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Excel / CSV Import Batches (audit record for bulk task imports)
CREATE TABLE IF NOT EXISTS public.task_import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  imported_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  file_name TEXT NOT NULL DEFAULT 'excel-import.xlsx',
  total_rows INTEGER NOT NULL CHECK (total_rows >= 0),
  imported_rows INTEGER NOT NULL CHECK (imported_rows >= 0),
  failed_rows INTEGER NOT NULL DEFAULT 0 CHECK (failed_rows >= 0),
  status TEXT NOT NULL DEFAULT 'Completed' CHECK (status IN ('Completed', 'Partial', 'Failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sequence for human-readable operational task codes (e.g., OPX-101)
CREATE SEQUENCE IF NOT EXISTS public.task_code_seq START 101;

-- Tasks (central operational work item)
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_code TEXT NOT NULL UNIQUE DEFAULT ('OPX-' || nextval('public.task_code_seq')::TEXT),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 200),
  description TEXT NOT NULL DEFAULT '',
  category_id UUID REFERENCES public.task_categories(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'Store Operations',
  priority public.task_priority NOT NULL DEFAULT 'Medium',
  status public.task_status NOT NULL DEFAULT 'Open',
  department TEXT NOT NULL DEFAULT 'Operations Control',
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
  area TEXT NOT NULL DEFAULT 'Region West',
  branch TEXT NOT NULL DEFAULT 'North Hub Branch',
  outlet TEXT NOT NULL DEFAULT 'Outlet 01 - Flagship Plaza',
  sla_hours INTEGER NOT NULL DEFAULT 72 CHECK (sla_hours BETWEEN 1 AND 8760),
  due_date DATE,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  import_batch_id UUID REFERENCES public.task_import_batches(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.task_categories(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Store Operations';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS area TEXT NOT NULL DEFAULT 'Region West';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS branch TEXT NOT NULL DEFAULT 'North Hub Branch';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS outlet TEXT NOT NULL DEFAULT 'Outlet 01 - Flagship Plaza';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS sla_hours INTEGER NOT NULL DEFAULT 72;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES public.task_import_batches(id) ON DELETE SET NULL;

-- Task Attachments (metadata pointing to Supabase Storage objects)
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 15728640),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task Comments (supports threaded replies via self-referential parent_id)
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  parent_id UUID REFERENCES public.task_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task Activity Logs (immutable audit trail)
CREATE TABLE IF NOT EXISTS public.task_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- In-App Notifications (Task Assigned, Updated, Completed, Comment Added, Due Soon, Overdue Alert)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_branches_area ON public.branches(area_id);
CREATE INDEX IF NOT EXISTS idx_outlets_branch ON public.outlets(branch_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON public.profiles(role, status);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles(area, branch, outlet);
CREATE INDEX IF NOT EXISTS idx_profiles_location_ids ON public.profiles(area_id, branch_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_user ON public.task_import_batches(imported_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON public.tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON public.tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_location ON public.tasks(area, branch, outlet);
CREATE INDEX IF NOT EXISTS idx_tasks_location_ids ON public.tasks(area_id, branch_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_import_batch ON public.tasks(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_attachments_task ON public.task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_task_created ON public.task_comments(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.task_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_activity_task_created ON public.task_activity_logs(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. SEED MASTER REFERENCE DATA (Idempotent)
-- ----------------------------------------------------------------------------
INSERT INTO public.areas (code, name) VALUES
  ('AREA-W', 'Region West'),
  ('AREA-C', 'Region Central'),
  ('AREA-E', 'Region East'),
  ('AREA-N', 'Region North')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.branches (area_id, code, name)
SELECT a.id, v.code, v.name
FROM (VALUES
  ('Region West',    'BR-NHB', 'North Hub Branch'),
  ('Region West',    'BR-WLB', 'West Logistics Branch'),
  ('Region Central', 'BR-CMB', 'Central Metro Branch'),
  ('Region Central', 'BR-SRB', 'South Retail Branch'),
  ('Region East',    'BR-ECB', 'East Coast Branch')
) AS v(area_name, code, name)
JOIN public.areas a ON a.name = v.area_name
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.outlets (branch_id, code, name)
SELECT b.id, v.code, v.name
FROM (VALUES
  ('North Hub Branch',      'OUT-01', 'Outlet 01 - Flagship Plaza'),
  ('Central Metro Branch',  'OUT-04', 'Outlet 04 - Harbor Bay'),
  ('East Coast Branch',     'OUT-07', 'Outlet 07 - Midtown Station'),
  ('South Retail Branch',   'OUT-12', 'Outlet 12 - Airport Terminal'),
  ('West Logistics Branch', 'OUT-W1', 'Warehouse Bay A'),
  ('West Logistics Branch', 'OUT-W2', 'Cold Storage Bay B')
) AS v(branch_name, code, name)
JOIN public.branches b ON b.name = v.branch_name
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.task_categories (code, name, default_sla_hours, description) VALUES
  ('CAT-COMP', 'Compliance & Audit',     24,  'Regulatory audits, thermal logs, and compliance verifications.'),
  ('CAT-PM',   'Preventive Maintenance', 48,  'Scheduled equipment servicing, inspections, and calibration.'),
  ('CAT-INV',  'Inventory & Stock',      72,  'Cycle counts, SKU discrepancy audits, and replenishment.'),
  ('CAT-HSE',  'Safety & HSE',           24,  'Lockout/tagout reviews, safety drills, and hazard mitigation.'),
  ('CAT-IT',   'IT & POS Support',       48,  'Terminal provisioning, scanner maintenance, and POS uptime.'),
  ('CAT-SOP',  'Store Operations',       72,  'Opening/closing readiness, SOP sign-offs, and floor execution.'),
  ('CAT-LOG',  'Logistics & Fleet',      72,  'Inbound/outbound freight reconciliation and dock turnaround.'),
  ('CAT-FAC',  'Facility Repair',        120, 'HVAC, generator load tests, electrical, and civil repairs.')
ON CONFLICT (name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. FUNCTIONS & TRIGGERS
-- ----------------------------------------------------------------------------

-- Keep updated_at current
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_areas_updated_at ON public.areas;
CREATE TRIGGER trg_areas_updated_at BEFORE UPDATE ON public.areas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_branches_updated_at ON public.branches;
CREATE TRIGGER trg_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_outlets_updated_at ON public.outlets;
CREATE TRIGGER trg_outlets_updated_at BEFORE UPDATE ON public.outlets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.task_categories;
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.task_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_comments_updated_at ON public.task_comments;
CREATE TRIGGER trg_comments_updated_at BEFORE UPDATE ON public.task_comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Keep foreign-key location references synced with area/branch/outlet labels on profiles
CREATE OR REPLACE FUNCTION public.sync_profile_location_refs()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.area_id IS NULL AND NEW.area IS NOT NULL THEN
    SELECT id INTO NEW.area_id FROM public.areas WHERE name = NEW.area LIMIT 1;
  ELSIF NEW.area_id IS NOT NULL THEN
    SELECT name INTO NEW.area FROM public.areas WHERE id = NEW.area_id LIMIT 1;
  END IF;

  IF NEW.branch_id IS NULL AND NEW.branch IS NOT NULL THEN
    SELECT id INTO NEW.branch_id FROM public.branches WHERE name = NEW.branch LIMIT 1;
  ELSIF NEW.branch_id IS NOT NULL THEN
    SELECT name INTO NEW.branch FROM public.branches WHERE id = NEW.branch_id LIMIT 1;
  END IF;

  IF NEW.outlet_id IS NULL AND NEW.outlet IS NOT NULL THEN
    SELECT id INTO NEW.outlet_id FROM public.outlets WHERE name = NEW.outlet LIMIT 1;
  ELSIF NEW.outlet_id IS NOT NULL THEN
    SELECT name INTO NEW.outlet FROM public.outlets WHERE id = NEW.outlet_id LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_refs ON public.profiles;
CREATE TRIGGER trg_profiles_sync_refs
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_location_refs();

-- Keep category/location FKs and completed_at timestamp synced on tasks
CREATE OR REPLACE FUNCTION public.sync_task_refs_and_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'Done' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.completed_at = COALESCE(NEW.completed_at, NOW());
    ELSIF OLD.status IS DISTINCT FROM 'Done' THEN
      NEW.completed_at = COALESCE(NEW.completed_at, NOW());
    END IF;
  ELSE
    NEW.completed_at = NULL;
  END IF;

  IF NEW.category_id IS NULL AND NEW.category IS NOT NULL THEN
    SELECT id INTO NEW.category_id FROM public.task_categories WHERE name = NEW.category LIMIT 1;
  ELSIF NEW.category_id IS NOT NULL THEN
    SELECT name INTO NEW.category FROM public.task_categories WHERE id = NEW.category_id LIMIT 1;
  END IF;

  IF NEW.area_id IS NULL AND NEW.area IS NOT NULL THEN
    SELECT id INTO NEW.area_id FROM public.areas WHERE name = NEW.area LIMIT 1;
  ELSIF NEW.area_id IS NOT NULL THEN
    SELECT name INTO NEW.area FROM public.areas WHERE id = NEW.area_id LIMIT 1;
  END IF;

  IF NEW.branch_id IS NULL AND NEW.branch IS NOT NULL THEN
    SELECT id INTO NEW.branch_id FROM public.branches WHERE name = NEW.branch LIMIT 1;
  ELSIF NEW.branch_id IS NOT NULL THEN
    SELECT name INTO NEW.branch FROM public.branches WHERE id = NEW.branch_id LIMIT 1;
  END IF;

  IF NEW.outlet_id IS NULL AND NEW.outlet IS NOT NULL THEN
    SELECT id INTO NEW.outlet_id FROM public.outlets WHERE name = NEW.outlet LIMIT 1;
  ELSIF NEW.outlet_id IS NOT NULL THEN
    SELECT name INTO NEW.outlet FROM public.outlets WHERE id = NEW.outlet_id LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_completed_at ON public.tasks;
DROP TRIGGER IF EXISTS trg_tasks_sync_refs_and_completion ON public.tasks;
CREATE TRIGGER trg_tasks_sync_refs_and_completion
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.sync_task_refs_and_completion();

-- Provision profile automatically on Supabase Auth signup (always defaults to Member)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status, department, job_title, area, branch, outlet)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'Member',
    'Active',
    COALESCE(NEW.raw_user_meta_data->>'department', 'Operations Control'),
    COALESCE(NEW.raw_user_meta_data->>'job_title', 'Operations Specialist'),
    COALESCE(NEW.raw_user_meta_data->>'area', 'Region West'),
    COALESCE(NEW.raw_user_meta_data->>'branch', 'North Hub Branch'),
    COALESCE(NEW.raw_user_meta_data->>'outlet', 'Outlet 01 - Flagship Plaza')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper function to inspect current user's role safely without RLS recursion
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND status = 'Active';
$$;

-- Log task activity & emit notifications on insert/update
CREATE OR REPLACE FUNCTION public.handle_task_audit_and_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := COALESCE(auth.uid(), NEW.created_by);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_activity_logs (task_id, actor_id, action, details)
    VALUES (
      NEW.id,
      v_actor,
      'Task Created',
      jsonb_build_object(
        'status', NEW.status,
        'priority', NEW.priority,
        'category', NEW.category,
        'area', NEW.area,
        'branch', NEW.branch,
        'outlet', NEW.outlet,
        'assignee_id', NEW.assignee_id
      )
    );

    IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id <> v_actor THEN
      INSERT INTO public.notifications (user_id, task_id, type, title, message)
      VALUES (
        NEW.assignee_id,
        NEW.id,
        'task_assigned',
        'Task Assigned: ' || NEW.task_code,
        'You were assigned to "' || NEW.title || '" (' || NEW.branch || ' / ' || NEW.outlet || ').'
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.task_activity_logs (task_id, actor_id, action, details)
      VALUES (
        NEW.id,
        v_actor,
        'Status Changed',
        jsonb_build_object('from', OLD.status, 'to', NEW.status)
      );

      IF NEW.status = 'Done' THEN
        IF NEW.created_by <> v_actor THEN
          INSERT INTO public.notifications (user_id, task_id, type, title, message)
          VALUES (
            NEW.created_by,
            NEW.id,
            'task_completed',
            'Task Completed: ' || NEW.task_code,
            '"' || NEW.title || '" has been marked Done.'
          );
        END IF;
      ELSIF NEW.assignee_id IS NOT NULL AND NEW.assignee_id <> v_actor THEN
        INSERT INTO public.notifications (user_id, task_id, type, title, message)
        VALUES (
          NEW.assignee_id,
          NEW.id,
          'task_updated',
          'Task Updated: ' || NEW.task_code,
          'Status changed from ' || OLD.status || ' to ' || NEW.status || '.'
        );
      END IF;
    END IF;

    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
      INSERT INTO public.task_activity_logs (task_id, actor_id, action, details)
      VALUES (
        NEW.id,
        v_actor,
        'Assignee Changed',
        jsonb_build_object('from', OLD.assignee_id, 'to', NEW.assignee_id)
      );

      IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id <> v_actor THEN
        INSERT INTO public.notifications (user_id, task_id, type, title, message)
        VALUES (
          NEW.assignee_id,
          NEW.id,
          'task_assigned',
          'Task Reassigned: ' || NEW.task_code,
          'You were assigned to "' || NEW.title || '".'
        );
      END IF;
    END IF;

    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO public.task_activity_logs (task_id, actor_id, action, details)
      VALUES (
        NEW.id,
        v_actor,
        'Priority Changed',
        jsonb_build_object('from', OLD.priority, 'to', NEW.priority)
      );
    END IF;

    IF (NEW.area IS DISTINCT FROM OLD.area) OR (NEW.branch IS DISTINCT FROM OLD.branch) OR (NEW.outlet IS DISTINCT FROM OLD.outlet) THEN
      INSERT INTO public.task_activity_logs (task_id, actor_id, action, details)
      VALUES (
        NEW.id,
        v_actor,
        'Location Updated',
        jsonb_build_object('area', NEW.area, 'branch', NEW.branch, 'outlet', NEW.outlet)
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_audit_and_notify ON public.tasks;
CREATE TRIGGER trg_task_audit_and_notify
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_task_audit_and_notify();

-- Emit comment_added notifications to assignee / task creator
CREATE OR REPLACE FUNCTION public.handle_comment_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
BEGIN
  SELECT task_code, title, assignee_id, created_by
  INTO v_task
  FROM public.tasks
  WHERE id = NEW.task_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_task.assignee_id IS NOT NULL AND v_task.assignee_id <> NEW.author_id THEN
    INSERT INTO public.notifications (user_id, task_id, type, title, message)
    VALUES (
      v_task.assignee_id,
      NEW.task_id,
      'comment_added',
      'New Comment: ' || v_task.task_code,
      'A team member commented on "' || v_task.title || '".'
    );
  END IF;

  IF v_task.created_by <> NEW.author_id AND v_task.created_by IS DISTINCT FROM v_task.assignee_id THEN
    INSERT INTO public.notifications (user_id, task_id, type, title, message)
    VALUES (
      v_task.created_by,
      NEW.task_id,
      'comment_added',
      'New Comment: ' || v_task.task_code,
      'A team member commented on "' || v_task.title || '".'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_notify ON public.task_comments;
CREATE TRIGGER trg_comment_notify
  AFTER INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_comment_notify();

-- ----------------------------------------------------------------------------
-- 7. OPERATIONAL ANALYTICS VIEWS (Security Invoker)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_task_sla_aging
WITH (security_invoker = true) AS
SELECT
  t.id,
  t.task_code,
  t.title,
  t.category,
  t.priority,
  t.status,
  t.area,
  t.branch,
  t.outlet,
  t.assignee_id,
  t.created_by,
  t.sla_hours,
  t.due_date,
  t.created_at,
  t.completed_at,
  ROUND(EXTRACT(EPOCH FROM (COALESCE(t.completed_at, NOW()) - t.created_at)) / 3600.0, 1) AS age_hours,
  FLOOR(EXTRACT(EPOCH FROM (COALESCE(t.completed_at, NOW()) - t.created_at)) / 86400.0)::INTEGER AS age_days,
  CASE
    WHEN FLOOR(EXTRACT(EPOCH FROM (COALESCE(t.completed_at, NOW()) - t.created_at)) / 86400.0) <= 1 THEN '0-1 Days'
    WHEN FLOOR(EXTRACT(EPOCH FROM (COALESCE(t.completed_at, NOW()) - t.created_at)) / 86400.0) <= 3 THEN '2-3 Days'
    WHEN FLOOR(EXTRACT(EPOCH FROM (COALESCE(t.completed_at, NOW()) - t.created_at)) / 86400.0) <= 7 THEN '4-7 Days'
    ELSE '8+ Days'
  END AS aging_bucket,
  CASE
    WHEN t.status = 'Cancelled' THEN 'Cancelled'
    WHEN t.status = 'Done' AND (EXTRACT(EPOCH FROM (COALESCE(t.completed_at, NOW()) - t.created_at)) / 3600.0) <= t.sla_hours THEN 'Met'
    WHEN (EXTRACT(EPOCH FROM (COALESCE(t.completed_at, NOW()) - t.created_at)) / 3600.0) > t.sla_hours THEN 'Breached'
    WHEN (EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600.0) >= (t.sla_hours * 0.75) THEN 'At Risk'
    ELSE 'On Track'
  END AS sla_status,
  CASE
    WHEN t.status IN ('Done', 'Cancelled') THEN 'Closed'
    WHEN t.due_date IS NULL THEN 'Unscheduled'
    WHEN t.due_date < CURRENT_DATE THEN 'Overdue'
    WHEN t.due_date <= CURRENT_DATE + INTERVAL '2 days' THEN 'Due Soon'
    ELSE 'On Schedule'
  END AS due_state
FROM public.tasks t;

CREATE OR REPLACE VIEW public.v_user_productivity
WITH (security_invoker = true) AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.role,
  p.department,
  p.area,
  p.branch,
  p.outlet,
  COUNT(v.id) FILTER (WHERE v.status <> 'Cancelled')::INTEGER AS assigned_tasks,
  COUNT(v.id) FILTER (WHERE v.status = 'Done')::INTEGER AS completed_tasks,
  COUNT(v.id) FILTER (WHERE v.due_state = 'Overdue')::INTEGER AS overdue_tasks,
  COUNT(v.id) FILTER (WHERE v.status <> 'Cancelled' AND v.sla_status <> 'Breached')::INTEGER AS sla_met_tasks,
  COALESCE(
    ROUND(
      100.0 * COUNT(v.id) FILTER (WHERE v.status = 'Done')
      / NULLIF(COUNT(v.id) FILTER (WHERE v.status <> 'Cancelled'), 0)
    )::INTEGER,
    0
  ) AS completion_rate,
  COALESCE(
    ROUND(
      100.0 * COUNT(v.id) FILTER (WHERE v.status <> 'Cancelled' AND v.sla_status <> 'Breached')
      / NULLIF(COUNT(v.id) FILTER (WHERE v.status <> 'Cancelled'), 0)
    )::INTEGER,
    100
  ) AS sla_compliance_rate
FROM public.profiles p
LEFT JOIN public.v_task_sla_aging v ON v.assignee_id = p.id
GROUP BY p.id, p.full_name, p.role, p.department, p.area, p.branch, p.outlet;

-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Master reference tables: Read for active authenticated users; Admin manages writes
DROP POLICY IF EXISTS "areas_select_team" ON public.areas;
CREATE POLICY "areas_select_team" ON public.areas FOR SELECT TO authenticated USING (public.current_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "areas_admin_write" ON public.areas;
CREATE POLICY "areas_admin_write" ON public.areas FOR ALL TO authenticated USING (public.current_user_role() = 'Admin') WITH CHECK (public.current_user_role() = 'Admin');

DROP POLICY IF EXISTS "branches_select_team" ON public.branches;
CREATE POLICY "branches_select_team" ON public.branches FOR SELECT TO authenticated USING (public.current_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "branches_admin_write" ON public.branches;
CREATE POLICY "branches_admin_write" ON public.branches FOR ALL TO authenticated USING (public.current_user_role() = 'Admin') WITH CHECK (public.current_user_role() = 'Admin');

DROP POLICY IF EXISTS "outlets_select_team" ON public.outlets;
CREATE POLICY "outlets_select_team" ON public.outlets FOR SELECT TO authenticated USING (public.current_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "outlets_admin_write" ON public.outlets;
CREATE POLICY "outlets_admin_write" ON public.outlets FOR ALL TO authenticated USING (public.current_user_role() = 'Admin') WITH CHECK (public.current_user_role() = 'Admin');

DROP POLICY IF EXISTS "categories_select_team" ON public.task_categories;
CREATE POLICY "categories_select_team" ON public.task_categories FOR SELECT TO authenticated USING (public.current_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "categories_admin_write" ON public.task_categories;
CREATE POLICY "categories_admin_write" ON public.task_categories FOR ALL TO authenticated USING (public.current_user_role() = 'Admin') WITH CHECK (public.current_user_role() = 'Admin');

-- Profiles: All active authenticated users can view team directory
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.current_user_role() IS NOT NULL);

-- Users can update their own non-privileged profile fields
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND status = (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Admins can manage any user profile (roles & status)
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'Admin')
  WITH CHECK (public.current_user_role() = 'Admin');

-- Task Import Batches: Team can view; authenticated active users can log their own imports
DROP POLICY IF EXISTS "import_batches_select_team" ON public.task_import_batches;
CREATE POLICY "import_batches_select_team"
  ON public.task_import_batches FOR SELECT
  TO authenticated
  USING (public.current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "import_batches_insert_own" ON public.task_import_batches;
CREATE POLICY "import_batches_insert_own"
  ON public.task_import_batches FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IS NOT NULL
    AND imported_by = auth.uid()
  );

-- Tasks: Active team members can read operational tasks
DROP POLICY IF EXISTS "tasks_select_team" ON public.tasks;
CREATE POLICY "tasks_select_team"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (public.current_user_role() IS NOT NULL);

-- Any active user can create tasks (with created_by = auth.uid())
DROP POLICY IF EXISTS "tasks_insert_team" ON public.tasks;
CREATE POLICY "tasks_insert_team"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IS NOT NULL
    AND created_by = auth.uid()
  );

-- Admin & Supervisor can update any task; Member can update tasks assigned to or created by them
DROP POLICY IF EXISTS "tasks_update_rbac" ON public.tasks;
CREATE POLICY "tasks_update_rbac"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() IN ('Admin', 'Supervisor')
    OR assignee_id = auth.uid()
    OR created_by = auth.uid()
  );

-- Admin can delete any task; Supervisor can delete tasks they created
DROP POLICY IF EXISTS "tasks_delete_rbac" ON public.tasks;
CREATE POLICY "tasks_delete_rbac"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (
    public.current_user_role() = 'Admin'
    OR (public.current_user_role() = 'Supervisor' AND created_by = auth.uid())
  );

-- Attachments: Active team members can view and upload; uploader or Admin/Supervisor can delete
DROP POLICY IF EXISTS "attachments_select_team" ON public.task_attachments;
CREATE POLICY "attachments_select_team"
  ON public.task_attachments FOR SELECT
  TO authenticated
  USING (public.current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "attachments_insert_team" ON public.task_attachments;
CREATE POLICY "attachments_insert_team"
  ON public.task_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IS NOT NULL
    AND uploaded_by = auth.uid()
  );

DROP POLICY IF EXISTS "attachments_delete_rbac" ON public.task_attachments;
CREATE POLICY "attachments_delete_rbac"
  ON public.task_attachments FOR DELETE
  TO authenticated
  USING (
    public.current_user_role() IN ('Admin', 'Supervisor')
    OR uploaded_by = auth.uid()
  );

-- Comments: Active team members can read & post; author or Admin can delete
DROP POLICY IF EXISTS "comments_select_team" ON public.task_comments;
CREATE POLICY "comments_select_team"
  ON public.task_comments FOR SELECT
  TO authenticated
  USING (public.current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "comments_insert_team" ON public.task_comments;
CREATE POLICY "comments_insert_team"
  ON public.task_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IS NOT NULL
    AND author_id = auth.uid()
  );

DROP POLICY IF EXISTS "comments_delete_rbac" ON public.task_comments;
CREATE POLICY "comments_delete_rbac"
  ON public.task_comments FOR DELETE
  TO authenticated
  USING (
    public.current_user_role() = 'Admin'
    OR author_id = auth.uid()
  );

-- Activity Logs: Read-only for active team members; written via triggers/services
DROP POLICY IF EXISTS "activity_select_team" ON public.task_activity_logs;
CREATE POLICY "activity_select_team"
  ON public.task_activity_logs FOR SELECT
  TO authenticated
  USING (public.current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "activity_insert_team" ON public.task_activity_logs;
CREATE POLICY "activity_insert_team"
  ON public.task_activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IS NOT NULL);

-- Notifications: Strictly private to recipient
DROP POLICY IF EXISTS "notifications_own_select" ON public.notifications;
CREATE POLICY "notifications_own_select"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_own_update" ON public.notifications;
CREATE POLICY "notifications_own_update"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;
CREATE POLICY "notifications_insert_authenticated"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 9. SUPABASE STORAGE BUCKET & POLICIES
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-attachments',
  'task-attachments',
  FALSE,
  15728640,
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "task_attachments_read" ON storage.objects;
CREATE POLICY "task_attachments_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'task-attachments' AND public.current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "task_attachments_upload" ON storage.objects;
CREATE POLICY "task_attachments_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'task-attachments' AND public.current_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "task_attachments_delete" ON storage.objects;
CREATE POLICY "task_attachments_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND (
      public.current_user_role() IN ('Admin', 'Supervisor')
      OR owner = auth.uid()
    )
  );
