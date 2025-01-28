import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { commonStyles } from '../styles/theme';
import { supabase } from '../lib/supabase';

interface AgentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Organization {
  id: string;
  name: string;
}

interface AgentProfile {
  id: string;
  full_name: string;
  role: string;
}

interface AgentStats {
  id: string;
  full_name: string;
  organizations: {
    id: string;
    name: string;
    available_tickets: number;
    active_tickets: number;
    completed_tickets: number;
    satisfaction_score: number;
  }[];
}

interface OrganizationResponse {
  id: string;
  name: string;
}

interface OrganizationUserResponse {
  organization_id: string;
  organizations: {
    id: string;
    name: string;
  };
}

export default function AgentDetailsModal({ isOpen, onClose }: AgentDetailsModalProps) {
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<AgentStats[]>([]);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAgents();
    }
  }, [isOpen]);

  async function fetchAgents() {
    try {
      setLoading(true);
      
      // Fetch all agents from profiles
      const { data: agentsData, error: agentsError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'agent')
        .order('full_name');

      if (agentsError) throw agentsError;

      const agentStats: AgentStats[] = [];

      // Fetch stats for each agent
      for (const agent of (agentsData as AgentProfile[] || [])) {
        // Get organizations this agent is part of
        const { data: agentOrgs, error: orgsError } = await supabase
          .from('organization_users')
          .select(`
            organization_id,
            organizations (
              id,
              name
            )
          `)
          .eq('user_id', agent.id);

        console.log('Agent:', agent.full_name);
        console.log('Agent Orgs Response:', agentOrgs);

        if (orgsError) throw orgsError;

        const organizations = [];

        // Get stats for each organization
        for (const org of (agentOrgs || [])) {
          const orgResponse = org as unknown as OrganizationUserResponse;
          const orgData = orgResponse.organizations;
          console.log('Processing org:', orgData);
          if (!orgData?.id || !orgData?.name) continue;

          // Get available (unassigned) tickets count
          const { count: availableTickets } = await supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgResponse.organization_id)
            .is('assigned_to', null)
            .neq('status', 'closed');

          console.log('Available tickets:', availableTickets);

          // Get active tickets count (assigned to this agent and open/in progress)
          const { count: activeTickets } = await supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgResponse.organization_id)
            .eq('assigned_to', agent.id)
            .in('status', ['open', 'in_progress']);

          // Get completed tickets count (assigned to this agent and closed)
          const { count: completedTickets } = await supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgResponse.organization_id)
            .eq('assigned_to', agent.id)
            .eq('status', 'closed');

          // Get satisfaction ratings for closed tickets
          const { data: closedTickets } = await supabase
            .from('tickets')
            .select('satisfaction_rating')
            .eq('organization_id', orgResponse.organization_id)
            .eq('assigned_to', agent.id)
            .eq('status', 'closed')
            .not('satisfaction_rating', 'is', null);

          const satisfactionScore = closedTickets?.length 
            ? Math.round(closedTickets.reduce((acc, ticket) => acc + (ticket.satisfaction_rating || 0), 0) / closedTickets.length * 100)
            : 0;

          organizations.push({
            id: orgData.id,
            name: orgData.name,
            available_tickets: availableTickets || 0,
            active_tickets: activeTickets || 0,
            completed_tickets: completedTickets || 0,
            satisfaction_score: satisfactionScore
          });
          console.log('Added organization:', organizations[organizations.length - 1]);
        }

        agentStats.push({
          id: agent.id,
          full_name: agent.full_name,
          organizations
        });
        console.log('Added agent stats:', agentStats[agentStats.length - 1]);
      }

      setAgents(agentStats);
    } catch (error) {
      console.error('Error fetching agent stats:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={`${commonStyles.card} w-full max-w-4xl transform p-6`}>
                <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md text-gray-400 hover:text-gray-300 focus:outline-none"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
        
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-sm sm:mx-0 sm:h-10 sm:w-10 ring-1 ring-white/10">
                    <svg className="h-6 w-6 text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className={commonStyles.heading}>
                      Agents Overview
                    </Dialog.Title>
                    {loading ? (
                      <div className="mt-8 flex justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent"></div>
                      </div>
                    ) : (
                      <div className="mt-8 space-y-4">
                        {agents.map((agent) => (
                          <div key={agent.id} className={commonStyles.cardWithHover}>
                            <div 
                              className="p-4 cursor-pointer"
                              onClick={() => setExpandedAgentId(expandedAgentId === agent.id ? null : agent.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
                                    <span className="text-yellow-400 font-medium text-lg">
                                      {agent.full_name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <h4 className={`${commonStyles.text} font-medium`}>
                                      {agent.full_name}
                                    </h4>
                                  </div>
                                </div>
                                <svg 
                                  className={`h-5 w-5 text-gray-400 transform transition-transform ${expandedAgentId === agent.id ? 'rotate-180' : ''}`} 
                                  xmlns="http://www.w3.org/2000/svg" 
                                  fill="none" 
                                  viewBox="0 0 24 24" 
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>

                              {expandedAgentId === agent.id && (
                                <div className="mt-6 space-y-4">
                                  {agent.organizations.map((org) => (
                                    <div key={org.id} className={`${commonStyles.card} !bg-white/5`}>
                                      <div className="p-4">
                                        <h4 className={`${commonStyles.text} font-medium mb-4`}>{org.name}</h4>
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                          <div>
                                            <div className="text-sm text-gray-400">Available Tickets</div>
                                            <div className="mt-1 flex items-baseline">
                                              <div className="text-2xl font-semibold text-white">{org.available_tickets}</div>
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-gray-400">Active Tickets</div>
                                            <div className="mt-1 flex items-baseline">
                                              <div className="text-2xl font-semibold text-white">{org.active_tickets}</div>
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-gray-400">Completed Tickets</div>
                                            <div className="mt-1 flex items-baseline">
                                              <div className="text-2xl font-semibold text-white">{org.completed_tickets}</div>
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-gray-400">Satisfaction Score</div>
                                            <div className="mt-1 flex items-baseline">
                                              <div className="text-2xl font-semibold text-white">{org.satisfaction_score}%</div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}