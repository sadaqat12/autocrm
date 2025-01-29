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

// Update the conversation context interface
interface ConversationContext {
  currentTicketId?: string;
  currentTicketSubject?: string;
  lastQuery?: string;
}

let conversationContext: ConversationContext = {};

// Update the system template to be more explicit about ticket creation vs updates
const systemTemplate = `You are an AI assistant for AutoCRM, a customer relationship management system.
Your role is to help users find information about tickets and take actions when requested.

When users ask for information or updates:
1. ONLY provide the requested information
2. DO NOT send messages or take any actions
3. FIRST try to find an existing ticket that matches the query
4. Use this format for ticket updates:
   "Here's the update on ticket #[ticket_id]:
   Subject: [subject]
   Status: [status]
   Latest messages:
   - [date]: [message]"

When explicitly asked to create a NEW ticket:
1. User must clearly request ticket creation (e.g., "create a ticket", "open a new ticket", "make a ticket")
2. ALWAYS use this exact format:
   "I'll create a ticket with the following details:
   Subject: [subject]
   Content: [content]
   Organization ID: [org_id]
   Priority: [priority]
   Category: [category]"

When explicitly asked to send messages to existing tickets:
1. User must clearly request to send a message (e.g., "send a message", "add a note", "reply")
2. ALWAYS use this exact format:
   "I'll send a message to ticket #[ticket_id]:
   [message_content]"

Configuration details:
1. For organization ID, use one from the user's available organizations in the context
2. For priority, use one of these exact values: low, medium, high
3. For category, use one of these exact values: bug, feature request, support, billing, other

Important rules:
1. NEVER send messages when users ask for updates or information
2. Only create tickets when explicitly requested
3. Always try to find existing tickets first
4. Use the exact ticket IDs from the context
5. Keep responses professional and focused

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

// Update searchTickets with more detailed logging
async function searchTickets(query: string, profile: UserProfile | null): Promise<TicketWithMessages[]> {
  try {
    const isAgent = profile?.role === 'agent' || profile?.role === 'admin';

    // Get the current user's organizations with names
    const { data: userOrgs, error: orgError } = await supabase
      .from('user_organizations')
      .select('*, organizations(name)');

    if (orgError || !userOrgs?.length) {
      console.error('Organization query error:', orgError);
      return [];
    }

    // Extract organization context from query
    const orgKeywords = userOrgs.map(org => ({
      id: org.organization_id,
      name: org.organizations?.name?.toLowerCase() || ''
    }));

    let targetOrgIds = userOrgs.map(org => org.organization_id);
    const queryLower = query.toLowerCase();
    
    // Check if query mentions specific organization
    for (const org of orgKeywords) {
      if (org.name && queryLower.includes(org.name.toLowerCase())) {
        targetOrgIds = [org.id];
        console.log('Found organization match:', org.name, 'ID:', org.id);
        break;
      }
    }

    console.log('Searching in organizations:', orgKeywords.map(org => org.name));
    console.log('Target org IDs:', targetOrgIds);

    // First get the tickets for target organizations
    const { data: tickets, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .in('organization_id', targetOrgIds)
      .order('updated_at', { ascending: false });

    if (ticketError || !tickets?.length) {
      console.error('Ticket query error:', ticketError);
      return [];
    }

    console.log('All tickets found:', tickets.map(t => ({
      id: t.id,
      subject: t.subject,
      org_id: t.organization_id,
      org_name: orgKeywords.find(org => org.id === t.organization_id)?.name || 'Unknown'
    })));

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

    // Log search terms
    console.log('Search terms:', {
      query: queryLower,
      searchingFor: 'trash can',
      inOrg: targetOrgIds[0]
    });

    // Do a direct subject search first
    const directMatches = ticketsWithMessages.filter(ticket => {
      // Extract meaningful terms from the query
      const words = queryLower.split(/\s+/);
      const stopWords = new Set([
        'what', 'is', 'the', 'on', 'in', 'at', 'by', 'for', 'to', 'of',
        'latest', 'update', 'status', 'about', 'regarding', 'concerning',
        'org', 'organization', 'llc', 'inc', 'corp'
      ]);
      const searchTerms = words.filter(word => 
        word.length > 2 && !stopWords.has(word)
      );

      // Check if any of the search terms appear in both query and subject/content
      const hasMatchingTerms = searchTerms.some(term => 
        ticket.subject.toLowerCase().includes(term) ||
        ticket.messages.some((msg: TicketMessage) => msg.content.toLowerCase().includes(term))
      );
      
      console.log('Checking ticket:', {
        id: ticket.id,
        subject: ticket.subject,
        hasMatch: hasMatchingTerms,
        searchTerms,
        matchingTerms: searchTerms.filter(term => 
          ticket.subject.toLowerCase().includes(term) ||
          ticket.messages.some((msg: TicketMessage) => msg.content.toLowerCase().includes(term))
        ),
        org_id: ticket.organization_id,
        org_name: orgKeywords.find(org => org.id === ticket.organization_id)?.name || 'Unknown'
      });
      
      return hasMatchingTerms;
    });

    if (directMatches.length > 0) {
      console.log('Found direct matches:', directMatches.map(t => ({
        id: t.id,
        subject: t.subject,
        org_id: t.organization_id,
        org_name: orgKeywords.find(org => org.id === t.organization_id)?.name || 'Unknown'
      })));
      return directMatches;
    }

    // If no direct matches, use AI for semantic search
    const searchPrompt = `Given this user query: "${query}"

Available tickets:
${ticketsWithMessages.map((ticket, index) => `
${index + 1}. Subject: ${ticket.subject}
   Organization: ${userOrgs.find(org => org.organization_id === ticket.organization_id)?.organizations?.name || 'Unknown'}
   Content: ${ticket.messages.slice(0, 3).map((msg: TicketMessage) => msg.content).join(' | ')}
   Status: ${ticket.status}
   Priority: ${ticket.priority}
   Category: ${ticket.category}
`).join('\n')}

Task: Find tickets that are semantically relevant to the query.
Consider these types of matches:
1. Direct keyword matches (highest priority)
2. Common synonyms and variations
3. Related concepts
4. Context clues

Return in this format:
MATCHES:[indices]
REASONING:[brief explanation for each match]`;

    const searchResponse = await chatModel.invoke([new HumanMessage(searchPrompt)]);
    const content = searchResponse.content.toString();
    console.log('Search response:', content);
    
    const matchesMatch = content.match(/MATCHES:([^\n]+)/);
    if (!matchesMatch || matchesMatch[1].trim().toLowerCase() === 'none') {
      console.log('No matches found in AI search');
      return [];
    }

    const indices = matchesMatch[1].trim()
      .split(',')
      .map(i => parseInt(i.trim()))
      .filter(i => !isNaN(i) && i > 0 && i <= ticketsWithMessages.length)
      .map(i => i - 1);

    const results = indices.map(i => ticketsWithMessages[i]);
    console.log('AI search results:', results.map(t => ({
      id: t.id,
      subject: t.subject,
      org_id: t.organization_id
    })));

    return results;
  } catch (error) {
    console.error('Error searching tickets:', error);
    return [];
  }
}

// Helper function to extract keywords from text
function extractKeywords(text: string): string {
  const words = text.toLowerCase().split(/\W+/);
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
  const keywords = words
    .filter(word => word.length > 2 && !commonWords.has(word))
    .slice(0, 10)
    .join(', ');
  return keywords;
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

// Update extractActionFromResponse to be more conservative about ticket creation
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
  // First check if this is just an information response
  if (response.startsWith("Here's the update on ticket #")) {
    return null;
  }

  // Check for explicit ticket creation request
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

  // Check for explicit message sending
  const messageSendingMatch = response.match(/I'll send a message to ticket #([^:]+):\s*([^\n]+)/i);
  
  if (messageSendingMatch) {
    const shortId = messageSendingMatch[1].trim();
    const fullId = getFullTicketId(tickets, shortId);
    
    if (!fullId) {
      console.error('Could not find full ticket ID for:', shortId);
      return null;
    }

    return {
      action: 'send_message',
      ticketId: fullId,
      message: messageSendingMatch[2].trim()
    };
  }

  // If no explicit patterns match, use AI to analyze for clear action intent
  const extractionPrompt = `
Given this AI response: "${response}"

Carefully analyze if this response indicates a CLEAR AND EXPLICIT intention to:
1. Create a new ticket (must include phrases like "create a ticket", "open a new ticket")
2. Send a message (must include phrases like "send a message", "add a note")

This should be an explicit statement of action, not just information sharing.

Information sharing (NOT actions):
- "The latest message is..."
- "Here's what I found..."
- "The ticket status is..."
- "The most recent update shows..."
- "There is a problem with..."
- "Issue reported in..."

Action indicators (these ARE actions):
- "I'll create a new ticket for..."
- "Let me open a ticket about..."
- "I'll send a message saying..."
- "I will add a note that..."

If an action is found, it must be an explicit statement of creating a ticket or sending a message.
Do not extract actions from responses that are just providing information or describing issues.

Return in this format if a clear action is found:
ACTION:action_type
TICKET:ticket_id
MESSAGE:message_content

Return "NONE" if the response is just providing information or if the action intent is not explicit.`;

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

// Update identifyTicket to consider organization context
async function identifyTicket(query: string, relevantTickets: TicketWithMessages[]): Promise<TicketWithMessages | null> {
  const extractionPrompt = `
Given this user query: "${query}"
And this conversation context:
- Last discussed ticket ID: ${conversationContext.currentTicketId || 'none'}
- Last discussed ticket subject: ${conversationContext.currentTicketSubject || 'none'}
- Last query: ${conversationContext.lastQuery || 'none'}

Determine if:
1. The user is referring to the same ticket as before
2. The user is asking about a specific ticket (by ID, subject, or description)
3. The user is asking about a new ticket
4. The user mentions a specific organization

Return in this format:
SAME_TICKET:true/false
TICKET_REFERENCE:[any specific ticket reference mentioned]
ORGANIZATION:[any organization name mentioned]`;

  const extractionResponse = await chatModel.invoke([new HumanMessage(extractionPrompt)]);
  const content = extractionResponse.content.toString();
  
  const sameTicket = content.includes('SAME_TICKET:true');
  const ticketRefMatch = content.match(/TICKET_REFERENCE:([^\n]+)/);
  const ticketRef = ticketRefMatch ? ticketRefMatch[1].trim() : null;
  const orgMatch = content.match(/ORGANIZATION:([^\n]+)/);
  const orgRef = orgMatch ? orgMatch[1].trim() : null;

  if (sameTicket && conversationContext.currentTicketId) {
    const ticket = relevantTickets.find(t => t.id === conversationContext.currentTicketId);
    // If org is mentioned, make sure the ticket belongs to that org
    if (ticket && (!orgRef || relevantTickets.some(t => t.id === ticket.id))) {
      return ticket;
    }
  }

  if (ticketRef) {
    // Try to find the ticket by ID, subject, or description
    const matchedTickets = relevantTickets.filter(t => 
      t.id.includes(ticketRef) || 
      t.subject.toLowerCase().includes(ticketRef.toLowerCase()) ||
      t.messages.some(m => m.content.toLowerCase().includes(ticketRef.toLowerCase()))
    );

    // If org is mentioned, filter by org
    if (orgRef) {
      return matchedTickets.find(t => relevantTickets.some(rt => rt.id === t.id)) || null;
    }
    
    return matchedTickets[0] || null;
  }

  return null;
}

// Add interface for organization data
interface Organization {
  id: string;
  name: string;
}

interface UserOrgWithDetails {
  organization_id: string;
  organizations: Organization;
}

// Update processUserMessage to use proper types
export async function processUserMessage(
  messages: ChatMessage[],
  query: string,
  profile: UserProfile | null
): Promise<string> {
  try {
    // Get the user's organizations with names
    const { data: userOrgs, error: orgError } = await supabase
      .from('user_organizations')
      .select('organization_id, organizations(id, name)') as { data: UserOrgWithDetails[] | null, error: any };

    if (orgError || !userOrgs?.length) {
      console.error('Organization query error:', orgError);
      return "I couldn't access your organization information. Please try again later.";
    }

    // Create a map of organization names to IDs for easier lookup
    const orgMap = new Map(userOrgs.map(org => [
      org.organizations?.name?.toLowerCase() || '',
      org.organization_id
    ]));

    // Search for relevant tickets
    const relevantTickets = await searchTickets(query, profile);
    
    // Identify the specific ticket being discussed
    const identifiedTicket = await identifyTicket(query, relevantTickets);
    
    // Update conversation context
    if (identifiedTicket) {
      conversationContext = {
        currentTicketId: identifiedTicket.id,
        currentTicketSubject: identifiedTicket.subject,
        lastQuery: query
      };
    }

    // Get AI response with context
    const response = await chatModel.invoke([
      new SystemMessage(systemTemplate),
      ...messages.map(msg => msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)),
      new HumanMessage(`Available organizations:
${userOrgs.map(org => `- ${org.organizations.name} (ID: ${org.organization_id})`).join('\n')}

${identifiedTicket ? `Current ticket being discussed:
Ticket #${identifiedTicket.id}
Subject: ${identifiedTicket.subject}
Status: ${identifiedTicket.status}
Organization: ${userOrgs.find(org => org.organization_id === identifiedTicket.organization_id)?.organizations.name || 'Unknown'}
Latest updates:
${identifiedTicket.messages.slice(0, 3).map(msg => 
  `- ${new Date(msg.created_at).toLocaleDateString()}: ${msg.content}`
).join('\n')}

Other relevant tickets:` : 'Relevant tickets:'}
${relevantTickets
  .filter(t => t.id !== identifiedTicket?.id)
  .map(ticket => `
Ticket #${ticket.id}
Subject: ${ticket.subject}
Status: ${ticket.status}
Organization: ${userOrgs.find(org => org.organization_id === ticket.organization_id)?.organizations.name || 'Unknown'}
Latest updates:
${ticket.messages.slice(0, 3).map(msg => 
  `- ${new Date(msg.created_at).toLocaleDateString()}: ${msg.content}`
).join('\n')}
`).join('\n')}

User query: ${query}`)
    ]);

    console.log('AI Response:', response.content);
    const action = await extractActionFromResponse(response.content.toString(), relevantTickets);
    console.log('Extracted Action:', action);

    if (action?.action === 'send_message' && action.ticketId && action.message) {
      try {
        await createTicketMessage(action.ticketId, action.message);
        return `${response.content}\n\n✓ Message sent successfully.`;
      } catch (error: any) {
        console.error('Error sending message:', error);
        return `${response.content}\n\n❌ Failed to send message: ${error?.message || 'Unknown error'}`;
      }
    } else if (action?.action === 'create_ticket' && action.newTicket) {
      console.log('Creating ticket with details:', action.newTicket);
      try {
        // Check if the organization ID matches any organization names
        const orgNameLower = query.toLowerCase();
        let targetOrgId = action.newTicket.organizationId;

        // Try to find organization ID by name in the query
        for (const [orgName, orgId] of orgMap.entries()) {
          if (orgName && orgNameLower.includes(orgName.toLowerCase())) {
            targetOrgId = orgId;
            break;
          }
        }

        if (!userOrgs.some(org => org.organization_id === targetOrgId)) {
          throw new Error('Invalid organization ID or organization not found');
        }

        const ticketId = await createTicket(
          action.newTicket.subject,
          action.newTicket.content,
          targetOrgId,
          action.newTicket.priority,
          action.newTicket.category
        );
        console.log('Ticket created successfully:', ticketId);
        const orgName = userOrgs.find(org => org.organization_id === targetOrgId)?.organizations.name || 'Unknown';
        return `${response.content}\n\n✓ Ticket created successfully in ${orgName} with ID: ${formatTicketIdForDisplay(ticketId)}`;
      } catch (error: any) {
        console.error('Error creating ticket:', error);
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