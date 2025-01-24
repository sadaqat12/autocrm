-- Seed data for AutoCRM

-- Organizations
INSERT INTO organizations (id, name, created_at) VALUES
    ('11111111-1111-1111-1111-111111111111', 'TechFlow Solutions', '2024-12-01T10:00:00Z'),
    ('22222222-2222-2222-2222-222222222222', 'Retail Plus Inc.', '2024-12-05T14:30:00Z'),
    ('33333333-3333-3333-3333-333333333333', 'HealthCare Pro', '2024-12-10T09:15:00Z');

-- Profiles (Users)
INSERT INTO profiles (id, full_name, phone, role, created_at, metadata) VALUES
    -- System Admins
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'John Anderson', '+1-555-0101', 'admin', '2024-12-01T08:00:00Z', '{"department": "IT", "location": "HQ"}'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Sarah Martinez', '+1-555-0102', 'admin', '2024-12-01T08:30:00Z', '{"department": "Operations", "location": "West"}'),
    
    -- Agents
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Michael Chen', '+1-555-0201', 'agent', '2024-12-02T09:00:00Z', '{"specialties": ["technical", "billing"]}'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Emily Watson', '+1-555-0202', 'agent', '2024-12-02T09:30:00Z', '{"specialties": ["support", "onboarding"]}'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'David Kim', '+1-555-0203', 'agent', '2024-12-02T10:00:00Z', '{"specialties": ["billing", "compliance"]}'),
    
    -- Regular Users
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Lisa Brown', '+1-555-0301', 'user', '2024-12-03T11:00:00Z', '{}'),
    ('gggggggg-gggg-gggg-gggg-gggggggggggg', 'Robert Taylor', '+1-555-0302', 'user', '2024-12-03T11:30:00Z', '{}'),
    ('hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh', 'Amanda Lee', '+1-555-0303', 'user', '2024-12-03T12:00:00Z', '{}'),
    ('iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii', 'James Wilson', '+1-555-0304', 'user', '2024-12-03T12:30:00Z', '{}');

-- Organization Users
INSERT INTO organization_users (organization_id, user_id, role, status, is_creator) VALUES
    -- TechFlow Solutions
    ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', 'accepted', true),
    ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin', 'accepted', false),
    ('11111111-1111-1111-1111-111111111111', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'member', 'accepted', false),
    
    -- Retail Plus Inc.
    ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner', 'accepted', true),
    ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'admin', 'accepted', false),
    ('22222222-2222-2222-2222-222222222222', 'gggggggg-gggg-gggg-gggg-gggggggggggg', 'member', 'accepted', false),
    
    -- HealthCare Pro
    ('33333333-3333-3333-3333-333333333333', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'owner', 'accepted', true),
    ('33333333-3333-3333-3333-333333333333', 'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh', 'member', 'accepted', false),
    ('33333333-3333-3333-3333-333333333333', 'iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii', 'member', 'pending', false);

-- Agent Organizations
INSERT INTO agent_organizations (agent_id, organization_id, created_at) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '2024-12-02T09:30:00Z'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', '2024-12-02T10:00:00Z'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '33333333-3333-3333-3333-333333333333', '2024-12-02T10:30:00Z');

-- Tickets
INSERT INTO tickets (id, organization_id, created_by, assigned_to, subject, status, priority, category, tags) VALUES
    -- TechFlow Solutions Tickets
    ('44444444-4444-4444-4444-444444444444', 
     '11111111-1111-1111-1111-111111111111',
     'ffffffff-ffff-ffff-ffff-ffffffffffff',
     'cccccccc-cccc-cccc-cccc-cccccccccccc',
     'Unable to access dashboard',
     'in_progress',
     'high',
     'bug',
     ARRAY['login', 'dashboard', 'urgent']::text[]),
     
    ('55555555-5555-5555-5555-555555555555',
     '11111111-1111-1111-1111-111111111111',
     'ffffffff-ffff-ffff-ffff-ffffffffffff',
     'cccccccc-cccc-cccc-cccc-cccccccccccc',
     'Feature request: Dark mode',
     'open',
     'low',
     'feature_request',
     ARRAY['ui', 'enhancement']::text[]),
     
    -- Retail Plus Inc. Tickets
    ('66666666-6666-6666-6666-666666666666',
     '22222222-2222-2222-2222-222222222222',
     'gggggggg-gggg-gggg-gggg-gggggggggggg',
     'dddddddd-dddd-dddd-dddd-dddddddddddd',
     'Billing cycle incorrect',
     'open',
     'high',
     'billing',
     ARRAY['invoice', 'urgent']::text[]),
     
    -- HealthCare Pro Tickets
    ('77777777-7777-7777-7777-777777777777',
     '33333333-3333-3333-3333-333333333333',
     'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh',
     'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
     'Need help with patient records',
     'resolved',
     'medium',
     'support',
     ARRAY['records', 'documentation']::text[]);

-- Ticket Messages
INSERT INTO ticket_messages (ticket_id, created_by, content, message_type, created_at) VALUES
    -- Dashboard Access Issue
    ('44444444-4444-4444-4444-444444444444',
     'ffffffff-ffff-ffff-ffff-ffffffffffff',
     'I''m getting a "403 Forbidden" error when trying to access the dashboard. This started happening after the latest update.',
     'public',
     '2024-12-14T10:00:00Z'),
     
    ('44444444-4444-4444-4444-444444444444',
     'cccccccc-cccc-cccc-cccc-cccccccccccc',
     'I''ve identified the issue with the permissions system. Working on a fix.',
     'public',
     '2024-12-14T10:05:00Z'),
     
    ('44444444-4444-4444-4444-444444444444',
     'cccccccc-cccc-cccc-cccc-cccccccccccc',
     'Note: Need to check recent permission changes in the auth system',
     'internal',
     '2024-12-14T10:06:00Z'),
     
    -- Dark Mode Feature Request
    ('55555555-5555-5555-5555-555555555555',
     'ffffffff-ffff-ffff-ffff-ffffffffffff',
     'Would love to have a dark mode option for the dashboard. It would help reduce eye strain during night shifts.',
     'public',
     '2024-12-14T11:00:00Z'),
     
    -- Billing Issue
    ('66666666-6666-6666-6666-666666666666',
     'gggggggg-gggg-gggg-gggg-gggggggggggg',
     'Our latest invoice shows incorrect billing cycle dates. It''s showing charges for dates outside our subscription period.',
     'public',
     '2024-12-14T13:00:00Z'),
     
    ('66666666-6666-6666-6666-666666666666',
     'dddddddd-dddd-dddd-dddd-dddddddddddd',
     'I''ve escalated this to our billing department. Will update you shortly.',
     'public',
     '2024-12-14T13:03:00Z'),
     
    -- Patient Records Help
    ('77777777-7777-7777-7777-777777777777',
     'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh',
     'Need assistance with accessing archived patient records from 2024.',
     'public',
     '2024-12-14T14:00:00Z'),
     
    ('77777777-7777-7777-7777-777777777777',
     'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
     'I''ve restored access to the archived records. You should be able to view them now.',
     'public',
     '2024-12-14T14:04:00Z'),
     
    ('77777777-7777-7777-7777-777777777777',
     'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
     'Resolved by restoring archive permissions',
     'internal',
     '2024-12-14T14:05:00Z');

-- Audit Log
INSERT INTO audit_log (ticket_id, user_id, event_type, from_value, to_value) VALUES
    ('44444444-4444-4444-4444-444444444444',
     'cccccccc-cccc-cccc-cccc-cccccccccccc',
     'status_change',
     'open',
     'in_progress'),
     
    ('77777777-7777-7777-7777-777777777777',
     'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
     'status_change',
     'open',
     'resolved');

-- Additional Tickets for TechFlow Solutions
INSERT INTO tickets (id, organization_id, created_by, assigned_to, subject, status, priority, category, tags, created_at) VALUES
    ('88888888-8888-8888-8888-888888888888',
     '11111111-1111-1111-1111-111111111111',
     'ffffffff-ffff-ffff-ffff-ffffffffffff',
     'cccccccc-cccc-cccc-cccc-cccccccccccc',
     'Performance issues in reporting module',
     'in_progress',
     'medium',
     'bug',
     ARRAY['performance', 'reporting', 'optimization']::text[],
     '2024-12-15T14:30:00Z'),
     
    ('99999999-9999-9999-9999-999999999999',
     '11111111-1111-1111-1111-111111111111',
     'ffffffff-ffff-ffff-ffff-ffffffffffff',
     null,
     'Export to PDF not working',
     'open',
     'low',
     'bug',
     ARRAY['export', 'pdf', 'reports']::text[],
     '2024-12-16T09:15:00Z'),
     
    ('aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa',
     '11111111-1111-1111-1111-111111111111',
     'ffffffff-ffff-ffff-ffff-ffffffffffff',
     'cccccccc-cccc-cccc-cccc-cccccccccccc',
     'Request for API documentation',
     'resolved',
     'low',
     'support',
     ARRAY['api', 'documentation']::text[],
     '2024-12-17T11:20:00Z');

-- Additional Tickets for Retail Plus Inc.
INSERT INTO tickets (id, organization_id, created_by, assigned_to, subject, status, priority, category, tags, created_at) VALUES
    ('bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb',
     '22222222-2222-2222-2222-222222222222',
     'gggggggg-gggg-gggg-gggg-gggggggggggg',
     'dddddddd-dddd-dddd-dddd-dddddddddddd',
     'Critical: Payment Gateway Down',
     'in_progress',
     'high',
     'bug',
     ARRAY['payment', 'gateway', 'urgent', 'critical']::text[],
     '2024-12-18T08:30:00Z'),
     
    ('cccccccc-0000-0000-0000-cccccccccccc',
     '22222222-2222-2222-2222-222222222222',
     'gggggggg-gggg-gggg-gggg-gggggggggggg',
     'dddddddd-dddd-dddd-dddd-dddddddddddd',
     'Add multi-currency support',
     'open',
     'medium',
     'feature_request',
     ARRAY['currency', 'international']::text[],
     '2024-12-19T10:45:00Z'),
     
    ('dddddddd-0000-0000-0000-dddddddddddd',
     '22222222-2222-2222-2222-222222222222',
     'gggggggg-gggg-gggg-gggg-gggggggggggg',
     null,
     'Update subscription plan',
     'open',
     'low',
     'billing',
     ARRAY['subscription', 'upgrade']::text[],
     '2024-12-20T15:20:00Z');

-- Additional Tickets for HealthCare Pro
INSERT INTO tickets (id, organization_id, created_by, assigned_to, subject, status, priority, category, tags, created_at) VALUES
    ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee',
     '33333333-3333-3333-3333-333333333333',
     'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh',
     'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
     'HIPAA Compliance Review Request',
     'in_progress',
     'high',
     'support',
     ARRAY['compliance', 'hipaa', 'security']::text[],
     '2024-12-21T09:00:00Z'),
     
    ('ffffffff-0000-0000-0000-ffffffffffff',
     '33333333-3333-3333-3333-333333333333',
     'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh',
     'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
     'Patient Data Migration Support',
     'open',
     'medium',
     'support',
     ARRAY['migration', 'data', 'patient-records']::text[],
     '2024-12-22T14:15:00Z'),
     
    ('11111111-0000-0000-0000-111111111111',
     '33333333-3333-3333-3333-333333333333',
     'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh',
     null,
     'Request for Staff Training Session',
     'open',
     'low',
     'support',
     ARRAY['training', 'staff', 'onboarding']::text[],
     '2024-12-23T11:30:00Z');

-- Additional Messages for Performance Issues Ticket
INSERT INTO ticket_messages (ticket_id, created_by, content, message_type, created_at) VALUES
    ('88888888-8888-8888-8888-888888888888',
     'ffffffff-ffff-ffff-ffff-ffffffffffff',
     'The reporting module is taking over 2 minutes to generate basic reports. This is affecting our daily operations.',
     'public',
     '2024-12-15T14:30:00Z'),
     
    ('88888888-8888-8888-8888-888888888888',
     'cccccccc-cccc-cccc-cccc-cccccccccccc',
     'Thank you for reporting this. Can you specify which report types are affected?',
     'public',
     '2024-12-15T14:33:00Z'),
     
    ('88888888-8888-8888-8888-888888888888',
     'ffffffff-ffff-ffff-ffff-ffffffffffff',
     'All sales reports and inventory reports are affected. Revenue reports seem to work fine.',
     'public',
     '2024-12-15T14:35:00Z'),
     
    ('88888888-8888-8888-8888-888888888888',
     'cccccccc-cccc-cccc-cccc-cccccccccccc',
     'Identified query optimization issues in sales/inventory reporting modules. Working on a fix.',
     'internal',
     '2024-12-15T14:36:00Z');

-- Additional Messages for Payment Gateway Ticket
INSERT INTO ticket_messages (ticket_id, created_by, content, message_type, created_at) VALUES
    ('bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb',
     'gggggggg-gggg-gggg-gggg-gggggggggggg',
     'URGENT: Payment gateway is not processing any transactions. All payments are failing since 8:15 AM.',
     'public',
     '2024-12-18T08:30:00Z'),
     
    ('bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb',
     'dddddddd-dddd-dddd-dddd-dddddddddddd',
     'This is being treated as highest priority. I''ve escalated to our payment processing team.',
     'public',
     '2024-12-18T08:32:00Z'),
     
    ('bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb',
     'dddddddd-dddd-dddd-dddd-dddddddddddd',
     'Initial investigation shows API timeout issues with payment provider. Contacting their support.',
     'internal',
     '2024-12-18T08:33:00Z'),
     
    ('bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb',
     'dddddddd-dddd-dddd-dddd-dddddddddddd',
     'Payment provider confirmed issues on their end. They''re implementing a fix. ETA 30 minutes.',
     'public',
     '2024-12-18T08:35:00Z'),
     
    ('bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb',
     'gggggggg-gggg-gggg-gggg-gggggggggggg',
     'Are there any updates? We''re losing sales.',
     'public',
     '2024-12-18T08:45:00Z');

-- Additional Messages for HIPAA Compliance Review
INSERT INTO ticket_messages (ticket_id, created_by, content, message_type, created_at) VALUES
    ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee',
     'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh',
     'We need a comprehensive review of our system for HIPAA compliance. Preparing for annual audit.',
     'public',
     '2024-12-21T09:00:00Z'),
     
    ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee',
     'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
     'I''ll help you with the compliance review. Let''s start with data encryption and access controls.',
     'public',
     '2024-12-21T09:03:00Z'),
     
    ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee',
     'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
     'Scheduling comprehensive security scan and documentation review.',
     'internal',
     '2024-12-21T09:04:00Z'),
     
    ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee',
     'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
     'Initial scan complete. Found some areas that need attention in audit logging.',
     'public',
     '2024-12-21T09:30:00Z'),
     
    ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee',
     'hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh',
     'When can we expect the full compliance report?',
     'public',
     '2024-12-21T10:00:00Z');

-- Additional Audit Log Entries
INSERT INTO audit_log (ticket_id, user_id, event_type, from_value, to_value, created_at) VALUES
    ('88888888-8888-8888-8888-888888888888',
     'cccccccc-cccc-cccc-cccc-cccccccccccc',
     'status_change',
     'open',
     'in_progress',
     '2024-12-15T14:45:00Z'),
     
    ('bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb',
     'dddddddd-dddd-dddd-dddd-dddddddddddd',
     'priority_change',
     'medium',
     'high',
     '2024-12-18T08:35:00Z'),
     
    ('bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb',
     'dddddddd-dddd-dddd-dddd-dddddddddddd',
     'status_change',
     'open',
     'in_progress',
     '2024-12-18T08:35:00Z'),
     
    ('eeeeeeee-0000-0000-0000-eeeeeeeeeeee',
     'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
     'assigned_to_change',
     null,
     'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
     '2024-12-21T09:30:00Z');
