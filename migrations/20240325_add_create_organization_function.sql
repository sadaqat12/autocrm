-- Create a function to handle organization creation with owner
CREATE OR REPLACE FUNCTION create_organization(
  org_name TEXT,
  owner_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Insert the organization
  INSERT INTO organizations (name)
  VALUES (org_name)
  RETURNING id INTO new_org_id;

  -- Insert the owner
  INSERT INTO organization_users (
    organization_id,
    user_id,
    role,
    status
  ) VALUES (
    new_org_id,
    owner_id,
    'owner',
    'accepted'
  );

  RETURN new_org_id;
END;
$$; 