-- Create ENUMs
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE ticket_category AS ENUM ('bug', 'feature_request', 'support', 'billing', 'other');
CREATE TYPE user_role AS ENUM ('admin', 'agent', 'owner', 'customer');
CREATE TYPE message_type AS ENUM ('public', 'internal', 'system');

-- Create organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create profiles table (extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    role user_role NOT NULL DEFAULT 'customer'::user_role,
    full_name VARCHAR NOT NULL,
    phone VARCHAR,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tickets table
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id),
    assigned_to UUID REFERENCES profiles(id),
    status ticket_status NOT NULL DEFAULT 'open'::ticket_status,
    priority ticket_priority NOT NULL DEFAULT 'medium'::ticket_priority,
    category ticket_category NOT NULL DEFAULT 'support'::ticket_category,
    subject VARCHAR NOT NULL,
    custom_fields JSONB,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ticket_messages table
CREATE TABLE ticket_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id),
    message_type message_type NOT NULL DEFAULT 'public'::message_type,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ticket_attachments table
CREATE TABLE ticket_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    message_id UUID REFERENCES ticket_messages(id) ON DELETE CASCADE,
    file_name VARCHAR NOT NULL,
    file_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit_log table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR NOT NULL,
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    user_id UUID REFERENCES profiles(id),
    from_value VARCHAR,
    to_value VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create agent_organizations table
CREATE TABLE agent_organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(agent_id, organization_id)
);

-- Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for tickets table
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for audit log on ticket status changes
CREATE OR REPLACE FUNCTION log_ticket_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO audit_log (event_type, ticket_id, user_id, from_value, to_value)
        VALUES ('ticket_status_changed', NEW.id, auth.uid(), OLD.status::text, NEW.status::text);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER log_ticket_status_changes
    AFTER UPDATE OF status ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION log_ticket_changes();

-- RLS Policies

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Organizations are visible to admins" ON organizations;
DROP POLICY IF EXISTS "Organizations visible to members and assigned agents" ON organizations;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- New policies for organizations
CREATE POLICY "Anyone can create organizations" ON organizations
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Organizations are visible to authenticated users" ON organizations
    FOR SELECT TO authenticated
    USING (true);

-- New policies for profiles
CREATE POLICY "Anyone can create their own profile" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view all profiles" ON profiles
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id);

-- Tickets policies
CREATE POLICY "Admins have full access to tickets" ON tickets
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'::user_role
        )
    );

CREATE POLICY "Agents can view and update assigned tickets" ON tickets
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'agent'::user_role
            AND (
                tickets.assigned_to = profiles.id
                OR EXISTS (
                    SELECT 1 FROM agent_organizations
                    WHERE agent_organizations.agent_id = profiles.id
                    AND agent_organizations.organization_id = tickets.organization_id
                )
            )
        )
    );

CREATE POLICY "Owners can view all org tickets" ON tickets
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'owner'::user_role
            AND profiles.organization_id = tickets.organization_id
        )
    );

CREATE POLICY "Customers can view their own tickets" ON tickets
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'customer'::user_role
            AND (
                tickets.created_by = profiles.id
                OR profiles.organization_id = tickets.organization_id
            )
        )
    );

CREATE POLICY "Customers can create tickets" ON tickets
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM organization_users
            WHERE organization_users.user_email = auth.jwt()->>'email'
            AND organization_users.organization_id = tickets.organization_id
            AND organization_users.status = 'accepted'
        )
    );

-- Messages policies
CREATE POLICY "Admins can view all messages" ON ticket_messages
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'::user_role
        )
    );

CREATE POLICY "Organization members can view their ticket messages" ON ticket_messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tickets
            JOIN profiles ON profiles.id = auth.uid()
            WHERE tickets.id = ticket_messages.ticket_id
            AND (
                -- Agents assigned to ticket or org
                (profiles.role = 'agent'::user_role AND 
                 (tickets.assigned_to = profiles.id 
                  OR EXISTS (
                      SELECT 1 FROM agent_organizations
                      WHERE agent_organizations.agent_id = profiles.id
                      AND agent_organizations.organization_id = tickets.organization_id
                  ))
                )
                OR
                -- Owners can see all org tickets
                (profiles.role = 'owner'::user_role AND 
                 tickets.organization_id = profiles.organization_id)
                OR
                -- Customers can see their own tickets
                (profiles.role = 'customer'::user_role AND 
                 (tickets.created_by = profiles.id 
                  OR profiles.organization_id = tickets.organization_id))
            )
        )
    );

CREATE POLICY "Users can create messages on accessible tickets" ON ticket_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tickets
            JOIN profiles ON profiles.id = auth.uid()
            WHERE tickets.id = ticket_messages.ticket_id
            AND (
                -- Admins can create messages on any ticket
                profiles.role = 'admin'::user_role
                OR
                -- Agents can create messages on assigned tickets or org tickets
                (profiles.role = 'agent'::user_role AND 
                 (tickets.assigned_to = profiles.id 
                  OR EXISTS (
                      SELECT 1 FROM agent_organizations
                      WHERE agent_organizations.agent_id = profiles.id
                      AND agent_organizations.organization_id = tickets.organization_id
                  ))
                )
                OR
                -- Owners can create messages on org tickets
                (profiles.role = 'owner'::user_role AND 
                 tickets.organization_id = profiles.organization_id)
                OR
                -- Customers can create messages on their own tickets
                (profiles.role = 'customer'::user_role AND 
                 (tickets.created_by = profiles.id 
                  OR profiles.organization_id = tickets.organization_id))
            )
            AND ticket_messages.created_by = auth.uid()
        )
    );

-- Attachments policies
CREATE POLICY "Admins can view all attachments" ON ticket_attachments
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'::user_role
        )
    );

CREATE POLICY "Organization members can view their ticket attachments" ON ticket_attachments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tickets
            JOIN profiles ON profiles.id = auth.uid()
            WHERE tickets.id = ticket_attachments.ticket_id
            AND (
                -- Agents assigned to ticket or org
                (profiles.role = 'agent'::user_role AND 
                 (tickets.assigned_to = profiles.id 
                  OR EXISTS (
                      SELECT 1 FROM agent_organizations
                      WHERE agent_organizations.agent_id = profiles.id
                      AND agent_organizations.organization_id = tickets.organization_id
                  ))
                )
                OR
                -- Owners can see all org tickets
                (profiles.role = 'owner'::user_role AND 
                 tickets.organization_id = profiles.organization_id)
                OR
                -- Customers can see their tickets
                (profiles.role = 'customer'::user_role AND 
                 (tickets.created_by = profiles.id OR profiles.organization_id = tickets.organization_id))
            )
        )
    );

-- Audit log policies
CREATE POLICY "Audit log visible to admins" ON audit_log
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'::user_role
        )
    );

CREATE POLICY "Owners can view their org audit log" ON audit_log
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            JOIN tickets ON tickets.id = audit_log.ticket_id
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'owner'::user_role
            AND profiles.organization_id = tickets.organization_id
        )
    );

-- Agent organizations policies
CREATE POLICY "Admins can manage agent organizations" ON agent_organizations
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'::user_role
        )
    );

CREATE POLICY "Agents can view their organizations" ON agent_organizations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (
                profiles.role = 'agent'::user_role
                AND agent_organizations.agent_id = profiles.id
            )
        )
    );

-- Indexes

-- Organizations indexes
CREATE INDEX idx_organizations_name ON organizations(name);

-- Profiles indexes
CREATE INDEX idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_full_name ON profiles(full_name);

-- Tickets indexes
CREATE INDEX idx_tickets_organization_id ON tickets(organization_id);
CREATE INDEX idx_tickets_created_by ON tickets(created_by);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_category ON tickets(category);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
-- Composite index for organization + status queries
CREATE INDEX idx_tickets_org_status ON tickets(organization_id, status);
-- Composite index for assigned agent + status queries
CREATE INDEX idx_tickets_assigned_status ON tickets(assigned_to, status);

-- Messages indexes
CREATE INDEX idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX idx_ticket_messages_created_by ON ticket_messages(created_by);
CREATE INDEX idx_ticket_messages_created_at ON ticket_messages(created_at);
CREATE INDEX idx_ticket_messages_type ON ticket_messages(message_type);

-- Attachments indexes
CREATE INDEX idx_ticket_attachments_ticket_id ON ticket_attachments(ticket_id);
CREATE INDEX idx_ticket_attachments_message_id ON ticket_attachments(message_id);

-- Audit log indexes
CREATE INDEX idx_audit_log_ticket_id ON audit_log(ticket_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX idx_audit_log_event_type ON audit_log(event_type);

-- Agent organizations indexes
CREATE INDEX idx_agent_organizations_agent_id ON agent_organizations(agent_id);
CREATE INDEX idx_agent_organizations_organization_id ON agent_organizations(organization_id); 