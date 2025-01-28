-- Add email column to organization_users table
ALTER TABLE organization_users
ADD COLUMN email TEXT;

-- Make user_id nullable since pending invites won't have a user_id yet
ALTER TABLE organization_users
ALTER COLUMN user_id DROP NOT NULL;

-- Add an index on email for faster lookups
CREATE INDEX idx_org_users_email ON organization_users(email);

-- Add a policy to allow org owners/admins to create pending invites
CREATE POLICY org_users_invite_insert
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
  AND NEW.status = 'pending'
); 