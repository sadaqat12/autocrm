-- Drop existing policies
DROP POLICY IF EXISTS ticket_attachments_select ON ticket_attachments;
DROP POLICY IF EXISTS ticket_attachments_insert ON ticket_attachments;
DROP POLICY IF EXISTS ticket_attachments_update ON ticket_attachments;
DROP POLICY IF EXISTS ticket_attachments_delete ON ticket_attachments;

-- Enable RLS on ticket_attachments table
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Policy for selecting ticket attachments
CREATE POLICY ticket_attachments_select ON ticket_attachments
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if user is an admin
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR
    -- Allow if user is an agent assigned to the organization
    EXISTS (
      SELECT 1 FROM agent_organizations ao
      JOIN tickets t ON t.organization_id = ao.organization_id
      WHERE t.id = ticket_id AND ao.agent_id = auth.uid()
    )
    OR
    -- Allow if user is a member of the organization
    EXISTS (
      SELECT 1 FROM organization_users ou
      JOIN tickets t ON t.organization_id = ou.organization_id
      WHERE t.id = ticket_id AND ou.user_id = auth.uid()
    )
    OR
    -- Allow if user created the ticket
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id AND t.created_by = auth.uid()
    )
  );

-- Policy for inserting ticket attachments
CREATE POLICY ticket_attachments_insert ON ticket_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if user is an admin
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR
    -- Allow if user is an agent assigned to the organization
    EXISTS (
      SELECT 1 FROM agent_organizations ao
      JOIN tickets t ON t.organization_id = ao.organization_id
      WHERE t.id = ticket_id AND ao.agent_id = auth.uid()
    )
    OR
    -- Allow if user is a member of the organization
    EXISTS (
      SELECT 1 FROM organization_users ou
      JOIN tickets t ON t.organization_id = ou.organization_id
      WHERE t.id = ticket_id AND ou.user_id = auth.uid()
    )
    OR
    -- Allow if user created the ticket
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id AND t.created_by = auth.uid()
    )
  );

-- Policy for updating ticket attachments
CREATE POLICY ticket_attachments_update ON ticket_attachments
  FOR UPDATE
  TO authenticated
  USING (
    -- Allow if user is an admin
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR
    -- Allow if user is an agent assigned to the organization
    EXISTS (
      SELECT 1 FROM agent_organizations ao
      JOIN tickets t ON t.organization_id = ao.organization_id
      WHERE t.id = ticket_id AND ao.agent_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Allow if user is an admin
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR
    -- Allow if user is an agent assigned to the organization
    EXISTS (
      SELECT 1 FROM agent_organizations ao
      JOIN tickets t ON t.organization_id = ao.organization_id
      WHERE t.id = ticket_id AND ao.agent_id = auth.uid()
    )
  );

-- Policy for deleting ticket attachments
CREATE POLICY ticket_attachments_delete ON ticket_attachments
  FOR DELETE
  TO authenticated
  USING (
    -- Allow if user is an admin
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR
    -- Allow if user is an agent assigned to the organization
    EXISTS (
      SELECT 1 FROM agent_organizations ao
      JOIN tickets t ON t.organization_id = ao.organization_id
      WHERE t.id = ticket_id AND ao.agent_id = auth.uid()
    )
  ); 