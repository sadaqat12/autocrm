-- Drop existing select policy
DROP POLICY IF EXISTS tickets_select ON tickets;

-- Create new select policy with proper member restrictions
CREATE POLICY tickets_select
ON tickets
FOR SELECT
TO authenticated
USING (
    -- System admins can see all tickets
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    )
    OR
    -- Agents can see all tickets in their assigned organizations
    EXISTS (
        SELECT 1
        FROM agent_organizations ao
        WHERE ao.agent_id = auth.uid()
          AND ao.organization_id = tickets.organization_id
    )
    OR
    -- Organization owners and admins can see all org tickets
    EXISTS (
        SELECT 1
        FROM organization_users ou
        WHERE ou.user_id = auth.uid()
          AND ou.organization_id = tickets.organization_id
          AND ou.role IN ('owner', 'admin')
          AND ou.status = 'accepted'
    )
    OR
    -- Regular members can only see their own tickets
    (
        EXISTS (
            SELECT 1
            FROM organization_users ou
            WHERE ou.user_id = auth.uid()
              AND ou.organization_id = tickets.organization_id
              AND ou.role = 'member'
              AND ou.status = 'accepted'
        )
        AND created_by = auth.uid()
    )
); 