-- Clean up existing data in the correct order to respect foreign key constraints
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

-- First, create variables for our UUIDs
DO $$
DECLARE
    -- Admin Users
    admin1_id UUID := 'c5b2184c-6479-4ba8-acea-b8b8c19349ba';
    admin2_id UUID := 'd8b3185c-7489-5ba9-bdfb-c9c9c19349bb';
    
    -- Agent Users
    agent1_id UUID := 'e9c4186c-8499-6cb9-cefc-d9d9d19349bc';
    agent2_id UUID := 'f9d5187c-9509-7dc9-dffd-e9e9e19349bd';
    agent3_id UUID := 'a9e6188c-0519-8ec9-effe-f9f9f19349be';
    
    -- Regular Users
    user1_id UUID := 'b9f7189c-1529-9fc9-ffff-f9f9f19349bf';
    user2_id UUID := 'c9f8190c-2539-0fc9-ffff-a9f9f19349bf';
    user3_id UUID := 'd9f9191c-3549-1fc9-ffff-b9f9f19349bf';
    user4_id UUID := 'e9f0192c-4559-2fc9-ffff-c9f9f19349bf';
    
    -- Organizations
    org1_id UUID := '50088ecb-2766-4f6d-ac16-1d80153dd9c4';
    org2_id UUID := '60099ecc-3776-5f7d-bc17-2d90263dd9c5';
    org3_id UUID := '7010aecd-4786-6f8d-cd18-3da0373dd9c6';
    
    -- Tickets
    ticket1_id UUID := '80011dce-5796-7f9d-de19-4eb0483dd9c7';
    ticket2_id UUID := '90012dcf-6806-8f0d-ef20-5ec0593dd9c8';

    -- Timestamp for consistent dates
    confirmation_timestamp TIMESTAMP WITH TIME ZONE := '2024-01-01 00:00:00+00';
BEGIN
    -- Create users in auth schema (using fixed UUIDs for consistency)
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        invited_at,
        confirmation_token,
        confirmation_sent_at,
        recovery_token,
        recovery_sent_at,
        email_change_token_new,
        email_change,
        email_change_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at,
        phone,
        phone_confirmed_at,
        phone_change,
        phone_change_token,
        phone_change_sent_at,
        email_change_token_current,
        email_change_confirm_status,
        banned_until,
        reauthentication_token,
        reauthentication_sent_at,
        is_sso_user,
        deleted_at,
        aud,
        role
    )
    SELECT 
        id,
        '00000000-0000-0000-0000-000000000000'::uuid,
        email,
        crypt('Password123!@#', gen_salt('bf')),
        confirmation_timestamp,
        NULL,
        '',
        confirmation_timestamp,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        confirmation_timestamp,
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{}'::jsonb,
        false,
        confirmation_timestamp,
        confirmation_timestamp,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        0,
        NULL,
        NULL,
        NULL,
        false,
        NULL,
        'authenticated',
        'authenticated'
    FROM (VALUES 
        (admin1_id, 'john.anderson@example.com'),
        (admin2_id, 'sarah.martinez@example.com'),
        (agent1_id, 'michael.chen@example.com'),
        (agent2_id, 'emily.watson@example.com'),
        (agent3_id, 'david.kim@example.com'),
        (user1_id, 'lisa.brown@example.com'),
        (user2_id, 'robert.taylor@example.com'),
        (user3_id, 'amanda.lee@example.com'),
        (user4_id, 'james.wilson@example.com')
    ) AS t(id, email);

    -- Organizations
    INSERT INTO public.organizations (id, name, created_at)
    VALUES
        (org1_id, 'TechFlow Solutions', '2024-12-01T10:00:00Z'),
        (org2_id, 'Retail Plus Inc.', '2024-12-05T14:30:00Z'),
        (org3_id, 'HealthCare Pro', '2024-12-10T09:15:00Z');

    -- Profiles (Users)
    INSERT INTO public.profiles (id, full_name, phone, role, created_at, metadata)
    VALUES
        -- System Admins
        (admin1_id, 'John Anderson', '+1-555-0101', 'admin', '2024-12-01T08:00:00Z', '{"department": "IT", "location": "HQ"}'),
        (admin2_id, 'Sarah Martinez', '+1-555-0102', 'admin', '2024-12-01T08:30:00Z', '{"department": "Operations", "location": "West"}'),
        
        -- Agents
        (agent1_id, 'Michael Chen', '+1-555-0201', 'agent', '2024-12-02T09:00:00Z', '{"specialties": ["technical", "billing"]}'),
        (agent2_id, 'Emily Watson', '+1-555-0202', 'agent', '2024-12-02T09:30:00Z', '{"specialties": ["support", "onboarding"]}'),
        (agent3_id, 'David Kim', '+1-555-0203', 'agent', '2024-12-02T10:00:00Z', '{"specialties": ["billing", "compliance"]}'),
        
        -- Regular Users
        (user1_id, 'Lisa Brown', '+1-555-0301', 'user', '2024-12-03T11:00:00Z', '{}'),
        (user2_id, 'Robert Taylor', '+1-555-0302', 'user', '2024-12-03T11:30:00Z', '{}'),
        (user3_id, 'Amanda Lee', '+1-555-0303', 'user', '2024-12-03T12:00:00Z', '{}'),
        (user4_id, 'James Wilson', '+1-555-0304', 'user', '2024-12-03T12:30:00Z', '{}');

    -- Organization Users
    INSERT INTO public.organization_users (organization_id, user_id, role, status, is_creator)
    VALUES
        -- TechFlow Solutions
        (org1_id, admin1_id, 'owner', 'accepted', true),
        (org1_id, agent1_id, 'admin', 'accepted', false),
        (org1_id, user1_id, 'member', 'accepted', false),
        
        -- Retail Plus Inc.
        (org2_id, admin2_id, 'owner', 'accepted', true),
        (org2_id, agent2_id, 'admin', 'accepted', false),
        (org2_id, user2_id, 'member', 'accepted', false),
        
        -- HealthCare Pro
        (org3_id, agent3_id, 'owner', 'accepted', true),
        (org3_id, user3_id, 'member', 'accepted', false),
        (org3_id, user4_id, 'member', 'pending', false);

    -- Agent Organizations
    INSERT INTO public.agent_organizations (agent_id, organization_id, created_at)
    VALUES
        (agent1_id, org1_id, '2024-12-02T09:30:00Z'),
        (agent2_id, org2_id, '2024-12-02T10:00:00Z'),
        (agent3_id, org3_id, '2024-12-02T10:30:00Z');

    -- Tickets
    INSERT INTO public.tickets (id, organization_id, created_by, assigned_to, subject, status, priority, category, tags, created_at)
    VALUES
        -- TechFlow Solutions Tickets
        (ticket1_id, org1_id, user1_id, agent1_id, 'Unable to access dashboard', 'in_progress', 'high', 'bug',
         ARRAY['login', 'dashboard', 'urgent']::text[], '2024-12-14T10:00:00Z'),
        
        (ticket2_id, org1_id, user1_id, agent1_id, 'Feature request: Dark mode', 'open', 'low', 'feature_request',
         ARRAY['ui', 'enhancement']::text[], '2024-12-14T11:00:00Z');

    -- Ticket Messages
    INSERT INTO public.ticket_messages (ticket_id, created_by, content, message_type, created_at)
    VALUES
        -- Dashboard Access Issue
        (ticket1_id, user1_id, 'I''m getting a "403 Forbidden" error when trying to access the dashboard. This started happening after the latest update.',
         'public', '2024-12-14T10:00:00Z'),
        
        (ticket1_id, agent1_id, 'I''ve identified the issue with the permissions system. Working on a fix.',
         'public', '2024-12-14T10:15:00Z'),
        
        -- Dark Mode Feature Request
        (ticket2_id, user1_id, 'Would love to have a dark mode option for the dashboard. It would help reduce eye strain during night shifts.',
         'public', '2024-12-14T11:00:00Z');

    -- Audit Log
    INSERT INTO public.audit_log (ticket_id, user_id, event_type, from_value, to_value, created_at)
    VALUES
        (ticket1_id, agent1_id, 'status_change', 'open', 'in_progress', '2024-12-14T10:15:00Z');
END $$;

-- Update passwords for all users
UPDATE auth.users 
SET 
    encrypted_password = crypt('Password123!@#', gen_salt('bf')),
    email_confirmed_at = now(),
    updated_at = now();
