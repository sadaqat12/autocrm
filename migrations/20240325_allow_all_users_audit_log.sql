-- Allow all organization members to view audit logs for their organization's tickets
CREATE POLICY audit_log_org_member_select
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
      AND ou.status = 'accepted'
  )
);

-- Comment: This policy allows any accepted member of an organization to view audit logs for tickets
-- belonging to their organization. This complements the existing policies that allow admins and
-- organization owners/admins to view audit logs. 