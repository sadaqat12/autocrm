-- 1. Drop tables/views/types in proper order
DROP TABLE IF EXISTS agent_organizations CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS organization_users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS ticket_attachments CASCADE;
DROP TABLE IF EXISTS ticket_messages CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP VIEW IF EXISTS user_organizations CASCADE;

DROP TYPE IF EXISTS ticket_status CASCADE;
DROP TYPE IF EXISTS ticket_priority CASCADE;
DROP TYPE IF EXISTS ticket_category CASCADE;
DROP TYPE IF EXISTS message_type CASCADE;
DROP TYPE IF EXISTS system_role CASCADE;
DROP TYPE IF EXISTS org_role CASCADE;
DROP TYPE IF EXISTS org_user_status CASCADE;

-- 2. Create ENUMs
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE ticket_category AS ENUM ('bug', 'feature_request', 'support', 'billing', 'other');
CREATE TYPE message_type AS ENUM ('public', 'internal', 'system');
CREATE TYPE system_role AS ENUM ('admin', 'agent', 'user');
CREATE TYPE org_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE org_user_status AS ENUM ('pending', 'accepted');

-- 3. Create Tables
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users (id),
    created_at TIMESTAMPTZ DEFAULT now(),
    full_name VARCHAR NOT NULL,
    phone VARCHAR,
    role system_role NOT NULL DEFAULT 'user',
    metadata JSONB
);

CREATE TABLE organization_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role org_role NOT NULL DEFAULT 'member',
    status org_user_status NOT NULL DEFAULT 'pending',
    is_creator BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE agent_organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_agent_org UNIQUE (agent_id, organization_id)
);

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id),
    assigned_to UUID REFERENCES profiles(id),
    subject VARCHAR NOT NULL,
    status ticket_status NOT NULL DEFAULT 'open',
    priority ticket_priority NOT NULL DEFAULT 'medium',
    category ticket_category NOT NULL DEFAULT 'support',
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ticket_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id),
    content TEXT NOT NULL,
    message_type message_type NOT NULL DEFAULT 'public',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ticket_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    message_id UUID REFERENCES ticket_messages(id) ON DELETE CASCADE,
    file_name VARCHAR NOT NULL,
    file_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    user_id UUID REFERENCES profiles(id),
    event_type VARCHAR NOT NULL,
    from_value VARCHAR,
    to_value VARCHAR,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create Indexes
CREATE INDEX idx_profiles_role ON profiles(role);

CREATE INDEX idx_organization_users_user_id ON organization_users(user_id);
CREATE INDEX idx_organization_users_org_id ON organization_users(organization_id);
CREATE INDEX idx_organization_users_role ON organization_users(role);
CREATE INDEX idx_organization_users_status ON organization_users(status);

CREATE INDEX idx_tickets_org_id ON tickets(organization_id);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_status ON tickets(status);

CREATE INDEX idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX idx_audit_log_ticket_id ON audit_log(ticket_id);

-- 5. Create a helpful view
CREATE VIEW user_organizations AS
SELECT 
    ou.user_id,
    ou.organization_id,
    ou.role AS org_role,
    o.name AS org_name,
    p.role AS system_role
FROM organization_users ou
JOIN organizations o ON o.id = ou.organization_id
JOIN profiles p ON p.id = ou.user_id
WHERE ou.status = 'accepted';

-- 6. Create Functions and Triggers

-- Update 'updated_at' column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Audit changes to tickets
CREATE OR REPLACE FUNCTION audit_ticket_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO audit_log (ticket_id, user_id, event_type, from_value, to_value)
        VALUES (NEW.id, auth.uid(), 'status_change', OLD.status::text, NEW.status::text);
    END IF;
    
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
        INSERT INTO audit_log (ticket_id, user_id, event_type, from_value, to_value)
        VALUES (NEW.id, auth.uid(), 'priority_change', OLD.priority::text, NEW.priority::text);
    END IF;
    
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
        INSERT INTO audit_log (ticket_id, user_id, event_type, from_value, to_value)
        VALUES (NEW.id, auth.uid(), 'assignment_change', OLD.assigned_to::text, NEW.assigned_to::text);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old triggers if they exist
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
DROP TRIGGER IF EXISTS ticket_audit_trigger ON tickets;

-- Create new triggers
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER ticket_audit_trigger
    AFTER UPDATE ON tickets
    FOR EACH ROW
    WHEN (
        OLD.status IS DISTINCT FROM NEW.status OR
        OLD.priority IS DISTINCT FROM NEW.priority OR
        OLD.assigned_to IS DISTINCT FROM NEW.assigned_to
    )
    EXECUTE FUNCTION audit_ticket_changes();

-- 7. Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Enable RLS on organization_users
ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;

-- Allow system admins full access
CREATE POLICY admin_full_access
ON organization_users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Allow organization owners/admins to manage their organizations
CREATE POLICY org_admin_manage
ON organization_users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.organization_id = organization_users.organization_id
    AND ou.role IN ('owner', 'admin')
    AND ou.status = 'accepted'
  )
);

-- Allow users to view their own organization memberships
CREATE POLICY user_view_own
ON organization_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow users to accept their own invites
CREATE POLICY user_accept_own_invite
ON organization_users
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (
  user_id = auth.uid()
  AND status IN ('pending', 'accepted')
);

------------------------------------------------------------------------------
-- RLS POLICIES
------------------------------------------------------------------------------

------------------------------------------------------------------------------
-- ORGANIZATIONS
------------------------------------------------------------------------------

-- INSERT (only WITH CHECK)
CREATE POLICY org_anyone_insert
ON organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- SELECT (only USING)
CREATE POLICY org_admin_select
ON organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY org_owner_admin_select
ON organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organization_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.organization_id = organizations.id
      AND ou.role IN ('owner', 'admin')
      AND ou.status = 'accepted'
  )
);

-- UPDATE (USING + WITH CHECK)
CREATE POLICY org_admin_update
ON organizations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
)
WITH CHECK (true);

CREATE POLICY org_owner_admin_update
ON organizations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organization_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.organization_id = organizations.id
      AND ou.role IN ('owner', 'admin')
      AND ou.status = 'accepted'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM organization_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.organization_id = organizations.id
      AND ou.role IN ('owner', 'admin')
      AND ou.status = 'accepted'
  )
);

-- DELETE (only USING)
CREATE POLICY org_admin_delete
ON organizations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY org_owner_admin_delete
ON organizations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organization_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.organization_id = organizations.id
      AND ou.role IN ('owner', 'admin')
      AND ou.status = 'accepted'
  )
);

------------------------------------------------------------------------------
-- PROFILES
------------------------------------------------------------------------------

-- Allow users to create their own profile
CREATE POLICY profiles_create_self
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
);

-- SELECT
CREATE POLICY profiles_admin_select
ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY profiles_user_select_self
ON profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY profiles_view_org_members
ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organization_users me
    JOIN organization_users other
      ON other.organization_id = me.organization_id
    WHERE me.user_id = auth.uid()
      AND other.user_id = profiles.id
      AND me.status = 'accepted'
      AND other.status = 'accepted'
  )
);

-- INSERT (if you allow direct insert)
CREATE POLICY profiles_admin_insert
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);

-- UPDATE
CREATE POLICY profiles_admin_update
ON profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
)
WITH CHECK (true);

-- A user can update their own row, but no check on "role" here:
CREATE POLICY profiles_user_update_self
ON profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (true);

-- DELETE
CREATE POLICY profiles_admin_delete
ON profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);

------------------------------------------------------------------------------
-- ORGANIZATION USERS
------------------------------------------------------------------------------

-- SELECT
CREATE POLICY org_users_admin_select
ON organization_users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY org_users_owner_admin_select
ON organization_users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organization_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.organization_id = organization_users.organization_id
      AND ou.role IN ('owner', 'admin')
      AND ou.status = 'accepted'
  )
);

CREATE POLICY org_users_members_select
ON organization_users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organization_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.organization_id = organization_users.organization_id
      AND ou.status = 'accepted'
  )
);

-- So invited user can see their own row, even if pending
CREATE POLICY org_users_self_pending_select
ON organization_users
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

-- INSERT
CREATE POLICY org_users_admin_insert
ON organization_users
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY org_users_owner_admin_insert
ON organization_users
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM organization_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.organization_id = organization_users.organization_id
      AND ou.role IN ('owner', 'admin')
      AND ou.status = 'accepted'
  )
);

-- UPDATE
CREATE POLICY org_users_admin_update
ON organization_users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
)
WITH CHECK (true);

CREATE POLICY org_users_owner_admin_update
ON organization_users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organization_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.organization_id = organization_users.organization_id
      AND ou.role IN ('owner', 'admin')
      AND ou.status = 'accepted'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM organization_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.organization_id = organization_users.organization_id
      AND ou.role IN ('owner', 'admin')
      AND ou.status = 'accepted'
  )
);

-- Let a "pending" user accept their own invite
CREATE POLICY org_users_self_pending_update
ON organization_users
FOR UPDATE
TO authenticated
USING (
  -- The old row must match: user is me, status = 'pending'
  user_id = auth.uid()
  AND status = 'pending'
)
WITH CHECK (
  -- The new row must keep the same user/org/role, but can set status to pending or accepted
  user_id = auth.uid()
  AND organization_id = organization_users.organization_id
  AND role = organization_users.role
  AND status IN ('pending','accepted')
);

-- DELETE
CREATE POLICY org_users_admin_delete
ON organization_users
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY org_users_owner_admin_delete
ON organization_users
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organization_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.organization_id = organization_users.organization_id
      AND ou.role IN ('owner', 'admin')
      AND ou.status = 'accepted'
  )
);

-- Organization Users Policies
CREATE POLICY org_users_self_select
ON organization_users
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
);

CREATE POLICY org_users_org_select
ON organization_users
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM organization_users my_orgs
        WHERE my_orgs.organization_id = organization_users.organization_id
        AND my_orgs.user_id = auth.uid()
        AND my_orgs.status = 'accepted'
        AND my_orgs.role IN ('owner', 'admin')
    )
);

------------------------------------------------------------------------------
-- AGENT ORGANIZATIONS
------------------------------------------------------------------------------

-- SELECT
CREATE POLICY agent_org_admin_select
ON agent_organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY agent_org_agent_select
ON agent_organizations
FOR SELECT
TO authenticated
USING (agent_id = auth.uid());

-- INSERT
CREATE POLICY agent_org_admin_insert
ON agent_organizations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);

-- UPDATE
CREATE POLICY agent_org_admin_update
ON agent_organizations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
)
WITH CHECK (true);

-- DELETE
CREATE POLICY agent_org_admin_delete
ON agent_organizations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);

------------------------------------------------------------------------------
-- TICKETS
------------------------------------------------------------------------------

-- SELECT
CREATE POLICY tickets_select
ON tickets
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    )
    OR
    EXISTS (
        SELECT 1
        FROM agent_organizations ao
        WHERE ao.agent_id = auth.uid()
          AND ao.organization_id = tickets.organization_id
    )
    OR
    EXISTS (
        SELECT 1
        FROM organization_users ou
        WHERE ou.user_id = auth.uid()
          AND ou.organization_id = tickets.organization_id
          AND ou.status = 'accepted'
    )
);

-- INSERT
CREATE POLICY tickets_insert
ON tickets
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    )
    OR
    EXISTS (
        SELECT 1
        FROM agent_organizations ao
        WHERE ao.agent_id = auth.uid()
          AND ao.organization_id = tickets.organization_id
    )
    OR
    EXISTS (
        SELECT 1
        FROM organization_users ou
        WHERE ou.user_id = auth.uid()
          AND ou.organization_id = tickets.organization_id
          AND ou.status = 'accepted'
    )
);

-- UPDATE
CREATE POLICY tickets_update
ON tickets
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    )
    OR
    EXISTS (
        SELECT 1
        FROM agent_organizations ao
        WHERE ao.agent_id = auth.uid()
          AND ao.organization_id = tickets.organization_id
    )
    OR
    EXISTS (
        SELECT 1
        FROM organization_users ou
        WHERE ou.user_id = auth.uid()
          AND ou.organization_id = tickets.organization_id
          AND ou.role IN ('owner','admin')
          AND ou.status = 'accepted'
    )
    OR (created_by = auth.uid())
)
WITH CHECK (true);

-- DELETE
CREATE POLICY tickets_delete
ON tickets
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    )
    OR
    EXISTS (
        SELECT 1
        FROM agent_organizations ao
        WHERE ao.agent_id = auth.uid()
          AND ao.organization_id = tickets.organization_id
    )
    OR
    EXISTS (
        SELECT 1
        FROM organization_users ou
        WHERE ou.user_id = auth.uid()
          AND ou.organization_id = tickets.organization_id
          AND ou.role IN ('owner','admin')
          AND ou.status = 'accepted'
    )
);

------------------------------------------------------------------------------
-- TICKET MESSAGES
------------------------------------------------------------------------------

-- SELECT
CREATE POLICY ticket_messages_select
ON ticket_messages
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM tickets t
        WHERE t.id = ticket_messages.ticket_id
          AND (
            EXISTS (
                SELECT 1
                FROM profiles p
                WHERE p.id = auth.uid()
                  AND p.role = 'admin'
            )
            OR
            EXISTS (
                SELECT 1
                FROM agent_organizations ao
                WHERE ao.agent_id = auth.uid()
                  AND ao.organization_id = t.organization_id
            )
            OR
            EXISTS (
                SELECT 1
                FROM organization_users ou
                WHERE ou.user_id = auth.uid()
                  AND ou.organization_id = t.organization_id
                  AND ou.status = 'accepted'
            )
          )
    )
);

-- INSERT
CREATE POLICY ticket_messages_insert
ON ticket_messages
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM tickets t
        WHERE t.id = ticket_messages.ticket_id
          AND (
            EXISTS (
                SELECT 1
                FROM profiles p
                WHERE p.id = auth.uid()
                  AND p.role = 'admin'
            )
            OR
            EXISTS (
                SELECT 1
                FROM agent_organizations ao
                WHERE ao.agent_id = auth.uid()
                  AND ao.organization_id = t.organization_id
            )
            OR
            EXISTS (
                SELECT 1
                FROM organization_users ou
                WHERE ou.user_id = auth.uid()
                  AND ou.organization_id = t.organization_id
                  AND ou.status = 'accepted'
            )
          )
    )
);

-- UPDATE
CREATE POLICY ticket_messages_update
ON ticket_messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM tickets t
    WHERE t.id = ticket_messages.ticket_id
      AND (
        EXISTS (
            SELECT 1
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'
        )
        OR
        EXISTS (
            SELECT 1
            FROM agent_organizations ao
            WHERE ao.agent_id = auth.uid()
              AND ao.organization_id = t.organization_id
        )
        OR
        EXISTS (
            SELECT 1
            FROM organization_users ou
            WHERE ou.user_id = auth.uid()
              AND ou.organization_id = t.organization_id
              AND ou.role IN ('owner','admin')
              AND ou.status = 'accepted'
        )
        OR (ticket_messages.created_by = auth.uid())
      )
  )
)
WITH CHECK (true);

-- DELETE
CREATE POLICY ticket_messages_delete
ON ticket_messages
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM tickets t
    WHERE t.id = ticket_messages.ticket_id
      AND (
        EXISTS (
            SELECT 1
            FROM profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'
        )
        OR
        EXISTS (
            SELECT 1
            FROM agent_organizations ao
            WHERE ao.agent_id = auth.uid()
              AND ao.organization_id = t.organization_id
        )
        OR
        EXISTS (
            SELECT 1
            FROM organization_users ou
            WHERE ou.user_id = auth.uid()
              AND ou.organization_id = t.organization_id
              AND ou.role IN ('owner','admin')
              AND ou.status = 'accepted'
        )
        OR (ticket_messages.created_by = auth.uid())
      )
  )
);

------------------------------------------------------------------------------
-- TICKET ATTACHMENTS
------------------------------------------------------------------------------

-- SELECT
CREATE POLICY ticket_attachments_select
ON ticket_attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM tickets t
    WHERE t.id = ticket_attachments.ticket_id
      AND (
        EXISTS (
          SELECT 1
          FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'admin'
        )
        OR
        EXISTS (
          SELECT 1
          FROM agent_organizations ao
          WHERE ao.agent_id = auth.uid()
            AND ao.organization_id = t.organization_id
        )
        OR
        EXISTS (
          SELECT 1
          FROM organization_users ou
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = t.organization_id
            AND ou.status = 'accepted'
        )
      )
  )
);

-- INSERT
CREATE POLICY ticket_attachments_insert
ON ticket_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM tickets t
    WHERE t.id = ticket_attachments.ticket_id
      AND (
        EXISTS (
          SELECT 1
          FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'admin'
        )
        OR
        EXISTS (
          SELECT 1
          FROM agent_organizations ao
          WHERE ao.agent_id = auth.uid()
            AND ao.organization_id = t.organization_id
        )
        OR
        EXISTS (
          SELECT 1
          FROM organization_users ou
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = t.organization_id
            AND ou.role IN ('owner','admin')
            AND ou.status = 'accepted'
        )
      )
  )
);

-- UPDATE
CREATE POLICY ticket_attachments_update
ON ticket_attachments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM tickets t
    WHERE t.id = ticket_attachments.ticket_id
      AND (
        EXISTS (
          SELECT 1
          FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'admin'
        )
        OR
        EXISTS (
          SELECT 1
          FROM agent_organizations ao
          WHERE ao.agent_id = auth.uid()
            AND ao.organization_id = t.organization_id
        )
        OR
        EXISTS (
          SELECT 1
          FROM organization_users ou
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = t.organization_id
            AND ou.role IN ('owner','admin')
            AND ou.status = 'accepted'
        )
      )
  )
)
WITH CHECK (true);

-- DELETE
CREATE POLICY ticket_attachments_delete
ON ticket_attachments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM tickets t
    WHERE t.id = ticket_attachments.ticket_id
      AND (
        EXISTS (
          SELECT 1
          FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'admin'
        )
        OR
        EXISTS (
          SELECT 1
          FROM agent_organizations ao
          WHERE ao.agent_id = auth.uid()
            AND ao.organization_id = t.organization_id
        )
        OR
        EXISTS (
          SELECT 1
          FROM organization_users ou
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = t.organization_id
            AND ou.role IN ('owner','admin')
            AND ou.status = 'accepted'
        )
      )
  )
);

------------------------------------------------------------------------------
-- AUDIT LOG (read-only)
------------------------------------------------------------------------------

-- SELECT
CREATE POLICY audit_log_admin_select
ON audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY audit_log_org_select
ON audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM tickets t
    JOIN organization_users ou 
      ON ou.organization_id = t.organization_id
    WHERE audit_log.ticket_id = t.id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('owner','admin')
      AND ou.status = 'accepted'
  )
);

-- INSERT policies for audit_log
CREATE POLICY audit_log_admin_insert
ON audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY audit_log_agent_insert
ON audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM tickets t
    JOIN agent_organizations ao ON ao.organization_id = t.organization_id
    WHERE t.id = audit_log.ticket_id
      AND ao.agent_id = auth.uid()
  )
);

CREATE POLICY audit_log_org_admin_insert
ON audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM tickets t
    JOIN organization_users ou ON ou.organization_id = t.organization_id
    WHERE t.id = audit_log.ticket_id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('owner','admin')
      AND ou.status = 'accepted'
  )
);

CREATE POLICY audit_log_ticket_creator_insert
ON audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM tickets t
    WHERE t.id = audit_log.ticket_id
      AND t.created_by = auth.uid()
  )
);

-- No UPDATE/DELETE => read-only logs

-- Create profile function that bypasses RLS
CREATE OR REPLACE FUNCTION create_profile(
    user_id UUID,
    user_full_name TEXT,
    user_phone TEXT,
    user_metadata JSONB
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO profiles (id, full_name, phone, role, metadata)
    VALUES (user_id, user_full_name, user_phone, 'user', user_metadata);
END;
$$;
