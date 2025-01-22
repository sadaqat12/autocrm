export interface Organization {
  id: string;
  name: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  is_creator: boolean;
  created_at: string;
} 