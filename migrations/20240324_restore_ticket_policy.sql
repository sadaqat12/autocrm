-- Drop the debug insert policy
DROP POLICY IF EXISTS tickets_insert ON tickets;

-- Restore the original insert policy
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