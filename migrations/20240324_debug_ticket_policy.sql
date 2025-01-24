-- Drop the insert policy
DROP POLICY IF EXISTS tickets_insert ON tickets;

-- Create a simpler insert policy for debugging
CREATE POLICY tickets_insert
ON tickets
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM organization_users ou
        WHERE ou.user_id = auth.uid()
          AND ou.organization_id = tickets.organization_id
    )
); 