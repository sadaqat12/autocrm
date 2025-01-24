-- Drop existing policies
DROP POLICY IF EXISTS tickets_select ON tickets;
DROP POLICY IF EXISTS tickets_insert ON tickets;
DROP POLICY IF EXISTS tickets_update ON tickets;
DROP POLICY IF EXISTS tickets_delete ON tickets;

-- Enable RLS
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

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