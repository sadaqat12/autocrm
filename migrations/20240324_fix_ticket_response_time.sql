-- Add first_response_at column to tickets table
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;

-- Create function to update first_response_at
CREATE OR REPLACE FUNCTION update_ticket_first_response()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if the message is from an agent and it's a public message
    IF EXISTS (
        SELECT 1 
        FROM profiles p
        WHERE p.id = NEW.created_by 
        AND p.role = 'agent'
    ) AND NEW.message_type = 'public' THEN
        -- Update first_response_at if it's not set
        UPDATE tickets t
        SET first_response_at = NEW.created_at
        WHERE t.id = NEW.ticket_id
        AND t.first_response_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on ticket_messages
DROP TRIGGER IF EXISTS update_ticket_first_response_trigger ON ticket_messages;
CREATE TRIGGER update_ticket_first_response_trigger
    AFTER INSERT ON ticket_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_first_response();

-- Backfill existing tickets' first_response_at
WITH first_agent_responses AS (
    SELECT 
        tm.ticket_id,
        MIN(tm.created_at) as first_response
    FROM ticket_messages tm
    JOIN profiles p ON p.id = tm.created_by
    WHERE p.role = 'agent'
    AND tm.message_type = 'public'
    GROUP BY tm.ticket_id
)
UPDATE tickets t
SET first_response_at = far.first_response
FROM first_agent_responses far
WHERE t.id = far.ticket_id
AND t.first_response_at IS NULL; 