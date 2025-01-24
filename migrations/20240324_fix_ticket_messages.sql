-- Drop existing policies
DROP POLICY IF EXISTS ticket_messages_select ON ticket_messages;
DROP POLICY IF EXISTS ticket_messages_insert ON ticket_messages;
DROP POLICY IF EXISTS ticket_messages_update ON ticket_messages;
DROP POLICY IF EXISTS ticket_messages_delete ON ticket_messages;

-- Enable RLS
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

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
            OR t.created_by = auth.uid()
          )
    )
);

-- INSERT (simpler policy that allows ticket creators)
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
            t.created_by = auth.uid()
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