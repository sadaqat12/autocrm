import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { commonStyles } from '../styles/theme';
import { supabase } from '../lib/supabase';

interface OrganizationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface OrgStats {
  id: string;
  name: string;
  totalUsers: number;
  activeTickets: number;
  avgResponseTime: string;
  satisfaction: number;
}

interface Ticket {
  id: string;
  created_at: string;
  created_by: string;
  ticket_messages: {
    created_at: string;
    created_by: string;
  }[];
}

export default function OrganizationDetailsModal({ isOpen, onClose }: OrganizationDetailsModalProps) {
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<OrgStats[]>([]);
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchOrganizations();
    }
  }, [isOpen]);

  async function fetchOrganizations() {
    try {
      setLoading(true);
      
      // Fetch all organizations
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .order('name');

      if (orgsError) throw orgsError;

      const orgStats: OrgStats[] = [];

      // Fetch stats for each organization
      for (const org of orgs || []) {
        // Get total users count for this org
        const { count: totalUsers } = await supabase
          .from('organization_users')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id)
          .eq('status', 'accepted')
          .eq('role', 'member');

        // Get active tickets count for this org
        const { count: activeTickets } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id)
          .neq('status', 'closed');

        // Get all tickets for response time calculation
        const { data: tickets } = await supabase
          .from('tickets')
          .select(`
            id,
            created_at,
            created_by,
            ticket_messages!ticket_messages_ticket_id_fkey (
              created_at,
              created_by
            )
          `)
          .eq('organization_id', org.id);

        // Calculate average response time
        let totalResponseTime = 0;
        let ticketsWithResponses = 0;

        tickets?.forEach((ticket: Ticket) => {
          if (ticket.ticket_messages && ticket.ticket_messages.length > 1) {
            const ticketCreatedAt = new Date(ticket.created_at).getTime();
            const firstResponse = ticket.ticket_messages.find(m => m.created_by !== ticket.created_by);
            
            if (firstResponse) {
              const responseTime = new Date(firstResponse.created_at).getTime() - ticketCreatedAt;
              if (responseTime > 0) {
                totalResponseTime += responseTime;
                ticketsWithResponses++;
              }
            }
          }
        });

        const avgResponseTimeMs = ticketsWithResponses > 0 ? totalResponseTime / ticketsWithResponses : 0;
        const avgResponseTimeHours = Math.round((avgResponseTimeMs / (1000 * 60 * 60)) * 10) / 10;

        // Calculate satisfaction rate
        const { data: closedTickets } = await supabase
          .from('tickets')
          .select('satisfaction_rating')
          .eq('organization_id', org.id)
          .eq('status', 'closed')
          .is('satisfaction_rating', 'not.null');

        const satisfiedTickets = closedTickets?.filter(t => t.satisfaction_rating >= 4) || [];
        const satisfactionRate = closedTickets?.length ? 
          Math.round((satisfiedTickets.length / closedTickets.length) * 100) : 0;

        orgStats.push({
          id: org.id,
          name: org.name,
          totalUsers: totalUsers || 0,
          activeTickets: activeTickets || 0,
          avgResponseTime: `${avgResponseTimeHours}h`,
          satisfaction: satisfactionRate
        });
      }

      setOrganizations(orgStats);
    } catch (error) {
      console.error('Error fetching organization stats:', error);
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
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm sm:mx-0 sm:h-10 sm:w-10 ring-1 ring-white/10">
                    <svg className="h-6 w-6 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className={commonStyles.heading}>
                      Organizations Overview
                    </Dialog.Title>
                    {loading ? (
                      <div className="mt-8 flex justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                      </div>
                    ) : (
                      <div className="mt-8 space-y-4">
                        {organizations.map((org) => (
                          <div key={org.id} className={commonStyles.cardWithHover}>
                            <div 
                              className="p-4 cursor-pointer"
                              onClick={() => setExpandedOrgId(expandedOrgId === org.id ? null : org.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
                                    <span className="text-blue-400 font-medium text-lg">
                                      {org.name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <h4 className={`${commonStyles.text} font-medium`}>
                                    {org.name}
                                  </h4>
                                </div>
                                <svg 
                                  className={`h-5 w-5 text-gray-400 transform transition-transform ${expandedOrgId === org.id ? 'rotate-180' : ''}`} 
                                  xmlns="http://www.w3.org/2000/svg" 
                                  fill="none" 
                                  viewBox="0 0 24 24" 
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>

                              {expandedOrgId === org.id && (
                                <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                                  <div className={`${commonStyles.card} !bg-white/5`}>
                                    <div className="p-4">
                                      <h4 className={`${commonStyles.text} font-medium mb-2`}>Users</h4>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                          <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                          </svg>
                                          <span className="text-2xl font-semibold text-white">{org.totalUsers}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className={`${commonStyles.card} !bg-white/5`}>
                                    <div className="p-4">
                                      <h4 className={`${commonStyles.text} font-medium mb-2`}>Active Tickets</h4>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                          <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                          </svg>
                                          <span className="text-2xl font-semibold text-white">{org.activeTickets}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className={`${commonStyles.card} !bg-white/5`}>
                                    <div className="p-4">
                                      <h4 className={`${commonStyles.text} font-medium mb-2`}>Response Time</h4>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                          <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          <span className="text-2xl font-semibold text-white">{org.avgResponseTime}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className={`${commonStyles.card} !bg-white/5`}>
                                    <div className="p-4">
                                      <h4 className={`${commonStyles.text} font-medium mb-2`}>Satisfaction</h4>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                          <svg className="h-5 w-5 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          <span className="text-2xl font-semibold text-white">{org.satisfaction}%</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
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