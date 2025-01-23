import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface TicketDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TicketStats {
  organization: string;
  total: number;
  open: number;
  closed: number;
  avg_resolution_time: number;
  by_priority: {
    high: number;
    medium: number;
    low: number;
  };
  by_category: Record<string, number>;
}

export default function TicketDetailsModal({ isOpen, onClose }: TicketDetailsModalProps) {
  const [ticketStats, setTicketStats] = useState<TicketStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchTicketStats();
    }
  }, [isOpen]);

  async function fetchTicketStats() {
    try {
      setLoading(true);
      
      // Fetch all organizations
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('id, name');

      if (orgsError) throw orgsError;

      const stats: TicketStats[] = [];

      // Get ticket stats for each organization
      for (const org of orgs || []) {
        // Get all tickets for this organization
        const { data: tickets } = await supabase
          .from('tickets')
          .select('*')
          .eq('organization_id', org.id);

        if (!tickets?.length) continue;

        // Calculate stats
        const openTickets = tickets.filter(t => t.status === 'open').length;
        const closedTickets = tickets.filter(t => t.status === 'closed').length;

        // Calculate average resolution time for closed tickets
        const resolutionTimes = tickets
          .filter(t => t.status === 'closed' && t.closed_at && t.created_at)
          .map(t => new Date(t.closed_at).getTime() - new Date(t.created_at).getTime());

        const avgResolutionHours = resolutionTimes.length
          ? (resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length) / (1000 * 60 * 60)
          : 0;

        // Count tickets by priority
        const byPriority = {
          high: tickets.filter(t => t.priority === 'high').length,
          medium: tickets.filter(t => t.priority === 'medium').length,
          low: tickets.filter(t => t.priority === 'low').length,
        };

        // Count tickets by category
        const byCategory = tickets.reduce((acc: Record<string, number>, ticket) => {
          const category = ticket.category || 'Uncategorized';
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        }, {});

        stats.push({
          organization: org.name,
          total: tickets.length,
          open: openTickets,
          closed: closedTickets,
          avg_resolution_time: Math.round(avgResolutionHours * 10) / 10,
          by_priority: byPriority,
          by_category: byCategory
        });
      }

      setTicketStats(stats);
    } catch (error) {
      console.error('Error fetching ticket stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Ticket Statistics</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="px-6 py-4 overflow-auto max-h-[calc(90vh-8rem)]">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-8">
              {ticketStats.map((stat, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">{stat.organization}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Overview */}
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <h4 className="text-sm font-medium text-gray-500 mb-3">Overview</h4>
                      <dl className="space-y-2">
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Total Tickets</dt>
                          <dd className="text-sm font-medium text-gray-900">{stat.total}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Open Tickets</dt>
                          <dd className="text-sm font-medium text-green-600">{stat.open}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Closed Tickets</dt>
                          <dd className="text-sm font-medium text-blue-600">{stat.closed}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Avg Resolution Time (hrs)</dt>
                          <dd className="text-sm font-medium text-gray-900">{stat.avg_resolution_time}</dd>
                        </div>
                      </dl>
                    </div>

                    {/* Priority Distribution */}
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <h4 className="text-sm font-medium text-gray-500 mb-3">By Priority</h4>
                      <dl className="space-y-2">
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">High Priority</dt>
                          <dd className="text-sm font-medium text-red-600">{stat.by_priority.high}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Medium Priority</dt>
                          <dd className="text-sm font-medium text-yellow-600">{stat.by_priority.medium}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Low Priority</dt>
                          <dd className="text-sm font-medium text-green-600">{stat.by_priority.low}</dd>
                        </div>
                      </dl>
                    </div>

                    {/* Category Distribution */}
                    <div className="bg-white rounded-lg p-4 shadow-sm md:col-span-2">
                      <h4 className="text-sm font-medium text-gray-500 mb-3">By Category</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {Object.entries(stat.by_category).map(([category, count]) => (
                          <div key={category} className="flex justify-between">
                            <dt className="text-sm text-gray-500">{category}</dt>
                            <dd className="text-sm font-medium text-gray-900">{count}</dd>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 