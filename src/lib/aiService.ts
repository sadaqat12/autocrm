import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { supabase } from './supabase';

interface UserProfile {
  id: string;
  role: string;
  full_name: string;
  [key: string]: any;
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  created_by: string;
  assigned_to: string | null;
  tags: string[];
}

interface TicketMessage {
  id: string;
  content: string;
  message_type: 'public' | 'internal' | 'system';
  created_at: string;
  created_by: string;
  ticket_id: string;
}

interface TicketWithMessages extends Ticket {
  messages: TicketMessage[];
}

// Initialize the ChatOpenAI model
const chatModel = new ChatOpenAI({
  openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY,
  modelName: "gpt-3.5-turbo",
  temperature: 0.7,
});

// Add interface for conversation context
interface ConversationContext {
  currentTicket?: TicketWithMessages;
  lastMentionedTickets?: TicketWithMessages[];
}

// Update the system template with correct priority values
const systemTemplate = `You are an AI assistant for AutoCRM, a customer relationship management system.
Your role is to help users find information about tickets and take actions when requested.

When responding to ticket creation requests:
1. ALWAYS use this exact format when creating a ticket:
   "I'll create a ticket with the following details:
   Subject: [subject]
   Content: [content]
   Organization ID: [org_id]
   Priority: [priority]
   Category: [category]"

2. For organization ID, use one from the user's available organizations in the context
3. For priority, use one of these exact values: low, medium, high
4. For category, use one of these exact values: bug, feature request, support, billing, other

For all other responses:
1. Provide clear, concise information from the available ticket data
2. Only take actions when explicitly requested
3. Use the exact ticket IDs from the context
4. Keep responses professional and focused

Never reveal internal notes or system messages to users.`;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Add a helper function to format ticket ID for display
function formatTicketIdForDisplay(fullId: string): string {
  return fullId.split('-')[0];
}

// Add a helper function to get full ticket ID from display format
function getFullTicketId(tickets: TicketWithMessages[], shortId: string): string | null {
  const ticket = tickets.find(t => t.id.startsWith(shortId));
  return ticket?.id || null;
}

async function searchTickets(query: string, profile: UserProfile | null): Promise<TicketWithMessages[]> {
  try {
    const isAgent = profile?.role === 'agent' || profile?.role === 'admin';

    // Get the current user's organizations
    const { data: userOrgs, error: orgError } = await supabase
      .from('user_organizations')
      .select('organization_id');

    if (orgError || !userOrgs?.length) {
      console.error('Organization query error:', orgError);
      return [];
    }

    // First get the tickets
    const { data: tickets, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .in('organization_id', userOrgs.map(org => org.organization_id))
      .order('updated_at', { ascending: false });

    if (ticketError || !tickets?.length) {
      console.error('Ticket query error:', ticketError);
      return [];
    }

    // Then get the messages for these tickets
    const { data: messages, error: messageError } = await supabase
      .from('ticket_messages')
      .select('*')
      .in('ticket_id', tickets.map(t => t.id))
      .order('created_at', { ascending: false });

    if (messageError) {
      console.error('Message query error:', messageError);
      return [];
    }

    // Combine tickets with their filtered messages
    const ticketsWithMessages = tickets.map(ticket => ({
      ...ticket,
      messages: (messages || [])
        .filter(msg => 
          msg.ticket_id === ticket.id && 
          (isAgent || msg.message_type === 'public')
        )
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }));

    // Use AI to find relevant tickets
    const searchPrompt = `Find tickets relevant to this query: "${query}"

Available tickets:
${ticketsWithMessages.map((ticket, index) => `
${index + 1}. Subject: ${ticket.subject}
   Content: ${ticket.messages.slice(0, 3).map((msg: TicketMessage) => msg.content).join(' | ')}
`).join('\n')}

Return relevant ticket indices (comma-separated) or "none".
Consider subject, content, and semantic meaning when matching.`;

    const searchResponse = await chatModel.invoke([new HumanMessage(searchPrompt)]);
    const indices = searchResponse.content.toString()
      .split(',')
      .map(i => parseInt(i.trim()))
      .filter(i => !isNaN(i) && i > 0 && i <= ticketsWithMessages.length)
      .map(i => i - 1);

    return indices.map(i => ticketsWithMessages[i]);
  } catch (error) {
    console.error('Error searching tickets:', error);
    return [];
  }
}

// Update createTicket function with correct priority values
async function createTicket(
  subject: string,
  content: string,
  organizationId: string,
  priority: string = 'medium',
  category: string = 'other'
): Promise<string> {
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error('Authentication error:', userError);
    throw new Error('User must be authenticated to create tickets');
  }

  // Verify user's organization membership
  const { data: userOrg, error: orgError } = await supabase
    .from('user_organizations')
    .select('*')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .single();

  if (orgError || !userOrg) {
    console.error('Organization verification error:', orgError);
    throw new Error('User does not have permission to create tickets for this organization');
  }

  // Validate category
  const validCategories = ['bug', 'feature request', 'support', 'billing', 'other'];
  const validCategory = validCategories.includes(category.toLowerCase()) ? category.toLowerCase() : 'other';

  // Validate priority
  const validPriorities = ['low', 'medium', 'high'];
  const validPriority = validPriorities.includes(priority.toLowerCase()) ? priority.toLowerCase() : 'medium';

  // Create the ticket with proper authentication
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .insert({
      subject,
      status: 'open',
      priority: validPriority,
      category: validCategory,
      organization_id: organizationId,
      created_by: user.id,
      tags: []
    })
    .select()
    .single();

  if (ticketError || !ticket) {
    console.error('Error creating ticket:', ticketError);
    throw ticketError;
  }

  // Create the initial message with proper authentication
  try {
    await createTicketMessage(ticket.id, content);
  } catch (error) {
    // If message creation fails, attempt to delete the ticket
    await supabase.from('tickets').delete().eq('id', ticket.id);
    throw error;
  }

  return ticket.id;
}

// Update createTicketMessage to handle authentication
async function createTicketMessage(
  ticketId: string, 
  content: string, 
  messageType: 'public' | 'internal' = 'public'
): Promise<void> {
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error('Authentication error:', userError);
    throw new Error('User must be authenticated to create messages');
  }

  // Verify user has access to the ticket
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('organization_id')
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    console.error('Ticket access verification error:', ticketError);
    throw new Error('Cannot access ticket');
  }

  // Verify user's organization membership
  const { data: userOrg, error: orgError } = await supabase
    .from('user_organizations')
    .select('*')
    .eq('user_id', user.id)
    .eq('organization_id', ticket.organization_id)
    .single();

  if (orgError || !userOrg) {
    console.error('Organization verification error:', orgError);
    throw new Error('User does not have permission to create messages for this ticket');
  }

  const { error } = await supabase
    .from('ticket_messages')
    .insert({
      ticket_id: ticketId,
      content,
      message_type: messageType,
      created_by: user.id
    });

  if (error) {
    console.error('Error creating message:', error);
    throw error;
  }
}

// Update extractActionFromResponse to properly parse ticket creation format
async function extractActionFromResponse(response: string, tickets: TicketWithMessages[]): Promise<{ 
  action: string; 
  ticketId?: string; 
  message?: string;
  newTicket?: {
    subject: string;
    content: string;
    organizationId: string;
    priority?: string;
    category?: string;
  };
} | null> {
  // First try to match ticket creation format directly
  const ticketCreationMatch = response.match(/I'll create a ticket with the following details:\s*Subject: ([^\n]+)\s*Content: ([^\n]+)\s*Organization ID: ([^\n]+)\s*Priority: ([^\n]+)\s*Category: ([^\n]+)/i);
  
  if (ticketCreationMatch) {
    return {
      action: 'create_ticket',
      newTicket: {
        subject: ticketCreationMatch[1].trim(),
        content: ticketCreationMatch[2].trim(),
        organizationId: ticketCreationMatch[3].trim(),
        priority: ticketCreationMatch[4].trim(),
        category: ticketCreationMatch[5].trim()
      }
    };
  }

  // If not a direct ticket creation, use the AI to extract other actions
  const extractionPrompt = `
Given this AI response: "${response}"

Analyze if this response indicates an intention to send a message or take another action.

For message sending, look for:
- "I'll send a message..."
- "I will add a note..."
- "I'll let them know..."
- "I'll inform them..."

If an action is found, extract:
1. The action type (e.g., "send_message")
2. The ticket ID
3. The message content

Return in this format if an action is found:
ACTION:action_type
TICKET:ticket_id
MESSAGE:message_content

Return "NONE" if no action is found.`;

  const extractionResponse = await chatModel.invoke([new HumanMessage(extractionPrompt)]);
  const content = extractionResponse.content.toString();

  if (content === 'NONE') {
    return null;
  }

  const actionMatch = content.match(/ACTION:(\w+)/);
  const ticketMatch = content.match(/TICKET:([^\n]+)/);
  const messageMatch = content.match(/MESSAGE:([^\n]+)/);

  if (actionMatch && actionMatch[1] === 'send_message' && ticketMatch) {
    const shortId = ticketMatch[1].trim();
    const fullId = getFullTicketId(tickets, shortId);
    
    if (!fullId) {
      console.error('Could not find full ticket ID for:', shortId);
      return null;
    }

    return {
      action: actionMatch[1],
      ticketId: fullId,
      message: messageMatch ? messageMatch[1] : undefined
    };
  }

  return null;
}

// Update processUserMessage to handle ticket creation
export async function processUserMessage(
  messages: ChatMessage[],
  query: string,
  profile: UserProfile | null
): Promise<string> {
  try {
    // Get the user's organizations first
    const { data: userOrgs, error: orgError } = await supabase
      .from('user_organizations')
      .select('organization_id');

    if (orgError || !userOrgs?.length) {
      console.error('Organization query error:', orgError);
      return "I couldn't access your organization information. Please try again later.";
    }

    // Search for relevant tickets
    const relevantTickets = await searchTickets(query, profile);
    
    // Get AI response with organization context
    const response = await chatModel.invoke([
      new SystemMessage(systemTemplate),
      ...messages.map(msg => msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)),
      new HumanMessage(`Available organizations: ${userOrgs.map(org => org.organization_id).join(', ')}

${relevantTickets.length > 0 ? `Relevant tickets:
${relevantTickets.map(ticket => `
Ticket #${ticket.id}
Subject: ${ticket.subject}
Status: ${ticket.status}
Latest updates:
${ticket.messages.slice(0, 3).map(msg => 
  `- ${new Date(msg.created_at).toLocaleDateString()}: ${msg.content}`
).join('\n')}
`).join('\n')}` : ''}

User query: ${query}`)
    ]);

    console.log('AI Response:', response.content); // Debug log

    // Check if action is needed
    const action = await extractActionFromResponse(response.content.toString(), relevantTickets);
    console.log('Extracted Action:', action); // Debug log

    if (action?.action === 'send_message' && action.ticketId && action.message) {
      try {
        await createTicketMessage(action.ticketId, action.message);
        return `${response.content}\n\n✓ Message sent successfully.`;
      } catch (error: any) {
        console.error('Error sending message:', error); // Debug log
        return `${response.content}\n\n❌ Failed to send message: ${error?.message || 'Unknown error'}`;
      }
    } else if (action?.action === 'create_ticket' && action.newTicket) {
      console.log('Creating ticket with details:', action.newTicket); // Debug log
      try {
        // Validate organization ID
        if (!userOrgs.some(org => org.organization_id === action.newTicket?.organizationId)) {
          throw new Error('Invalid organization ID');
        }

        const ticketId = await createTicket(
          action.newTicket.subject,
          action.newTicket.content,
          action.newTicket.organizationId,
          action.newTicket.priority,
          action.newTicket.category
        );
        console.log('Ticket created successfully:', ticketId); // Debug log
        return `${response.content}\n\n✓ Ticket created successfully with ID: ${formatTicketIdForDisplay(ticketId)}`;
      } catch (error: any) {
        console.error('Error creating ticket:', error); // Debug log
        return `${response.content}\n\n❌ Failed to create ticket: ${error?.message || 'Unknown error'}`;
      }
    }

    return response.content.toString();
  } catch (error) {
    console.error('Error processing message:', error);
    throw new Error('Failed to process message');
  }
}

// Helper function to extract ticket numbers from text
export function extractTicketNumber(text: string): string | null {
  const match = text.match(/#(\d+)/);
  return match ? match[1] : null;
}

// Helper function to extract organization IDs from text
export function extractOrganizationId(text: string): string | null {
  const match = text.match(/org[anization]*[\s-]*(id)?[:]\s*(\w+)/i);
  return match ? match[2] : null;
}

// Helper function to determine if the message requires confirmation
export function requiresConfirmation(text: string): boolean {
  const actionWords = ['update', 'delete', 'remove', 'change', 'modify', 'create'];
  return actionWords.some(word => text.toLowerCase().includes(word));
} 