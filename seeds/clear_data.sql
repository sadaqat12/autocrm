-- Clear all data while respecting foreign key constraints
BEGIN;
  -- First, disable row level security temporarily to allow truncate
  ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.organization_users DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.agent_organizations DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.tickets DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.ticket_messages DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.ticket_attachments DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.audit_log DISABLE ROW LEVEL SECURITY;

  -- Now truncate in the correct order (children first, then parents)
  TRUNCATE TABLE public.ticket_attachments CASCADE;
  TRUNCATE TABLE public.ticket_messages CASCADE;
  TRUNCATE TABLE public.audit_log CASCADE;
  TRUNCATE TABLE public.tickets CASCADE;
  TRUNCATE TABLE public.agent_organizations CASCADE;
  TRUNCATE TABLE public.organization_users CASCADE;
  TRUNCATE TABLE public.profiles CASCADE;
  TRUNCATE TABLE public.organizations CASCADE;
  TRUNCATE TABLE auth.users CASCADE;

  -- Re-enable row level security
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.organization_users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.agent_organizations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
COMMIT; 