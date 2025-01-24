-- Drop existing policies if they exist
DROP POLICY IF EXISTS audit_log_agent_insert ON audit_log;

-- Create policy for agents to insert audit logs
CREATE POLICY audit_log_agent_insert
ON audit_log
FOR INSERT
TO authenticated
WITH CHECK (
    -- Allow if user is an agent assigned to the organization
    EXISTS (
        SELECT 1
        FROM tickets t
        JOIN agent_organizations ao ON ao.organization_id = t.organization_id
        WHERE t.id = audit_log.ticket_id
          AND ao.agent_id = auth.uid()
    )
); 