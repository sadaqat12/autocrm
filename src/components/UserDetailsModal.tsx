import { useEffect, useState, Fragment } from 'react';
import { supabase } from '../lib/supabase';
import { Dialog, Transition } from '@headlessui/react';
import { commonStyles } from '../styles/theme';

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserStats {
  id: string;
  full_name: string;
  role: string;
  owned_orgs?: number;
  member_orgs?: number;
  tickets_created?: number;
  created_at: string;
}

interface RoleBasedUsers {
  admins: UserStats[];
  agents: UserStats[];
  users: UserStats[];
}

export default function UserDetailsModal({ isOpen, onClose }: UserDetailsModalProps) {
  const [users, setUsers] = useState<RoleBasedUsers>({
    admins: [],
    agents: [],
    users: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchUserDetails();
    }
  }, [isOpen]);

  async function fetchUserDetails() {
    try {
      setLoading(true);
      
      // Fetch all users with their profiles and roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, created_at, role');

      if (profilesError) throw profilesError;

      const userStats: UserStats[] = [];

      // For each user, fetch relevant stats
      for (const profile of (profiles || [])) {
        let userStat: UserStats = {
          id: profile.id,
          full_name: profile.full_name,
          created_at: profile.created_at,
          role: profile.role || 'user' // Default to 'user' if role is null
        };

        // Only calculate org and ticket stats for regular users
        if (userStat.role === 'user') {
          // Get user's organizations and roles
          const { data: orgUsers } = await supabase
            .from('organization_users')
            .select(`
              role,
              organizations (
                id,
                name
              )
            `)
            .eq('user_id', profile.id);

          const ownedOrgs = (orgUsers || []).filter(ou => ou.role === 'owner').length;
          const memberOrgs = (orgUsers || []).filter(ou => ou.role === 'member').length;

          const { count: ticketsCreated } = await supabase
            .from('tickets')
            .select('*', { count: 'exact' })
            .eq('created_by', profile.id);

          userStat.owned_orgs = ownedOrgs;
          userStat.member_orgs = memberOrgs;
          userStat.tickets_created = ticketsCreated || 0;
        }

        userStats.push(userStat);
      }

      // Group users by role
      setUsers({
        admins: userStats.filter(u => u.role === 'admin'),
        agents: userStats.filter(u => u.role === 'agent'),
        users: userStats.filter(u => u.role === 'user')
      });
    } catch (error) {
      console.error('Error fetching user details:', error);
    } finally {
      setLoading(false);
    }
  }

  const renderAdminOrAgentCard = (user: UserStats) => (
    <div key={user.id} className={commonStyles.cardWithHover}>
      <div className="p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
            <span className="text-blue-400 font-medium text-lg">
              {user.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-grow">
            <h4 className={`${commonStyles.text} font-medium`}>{user.full_name}</h4>
            <p className="text-sm text-gray-400">
              Member since: {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderUserCard = (user: UserStats) => (
    <div key={user.id} className={commonStyles.cardWithHover}>
      <div className="p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
            <span className="text-blue-400 font-medium text-lg">
              {user.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-grow">
            <h4 className={`${commonStyles.text} font-medium`}>{user.full_name}</h4>
            <p className="text-sm text-gray-400">
              Member since: {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className={`${commonStyles.cardWithHover} p-3`}>
            <h5 className="text-sm text-gray-400 mb-1">Organizations Owned</h5>
            <p className={`${commonStyles.text} font-medium`}>{user.owned_orgs}</p>
          </div>
          <div className={`${commonStyles.cardWithHover} p-3`}>
            <h5 className="text-sm text-gray-400 mb-1">Organizations Joined</h5>
            <p className={`${commonStyles.text} font-medium`}>{user.member_orgs}</p>
          </div>
          <div className={`${commonStyles.cardWithHover} p-3`}>
            <h5 className="text-sm text-gray-400 mb-1">Tickets Created</h5>
            <p className={`${commonStyles.text} font-medium`}>{user.tickets_created}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderUserGroup = (title: string, users: UserStats[], isAdmin: boolean = false) => (
    <div className="mb-8 last:mb-0">
      <h4 className={`${commonStyles.text} text-lg font-medium mb-4`}>{title}</h4>
      <div className="space-y-4">
        {users.map((user) => (
          isAdmin ? renderAdminOrAgentCard(user) : renderUserCard(user)
        ))}
      </div>
    </div>
  );

  if (!isOpen) return null;

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
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm sm:mx-0 sm:h-10 sm:w-10 ring-1 ring-white/10">
                    <svg className="h-6 w-6 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className={commonStyles.heading}>
                      User Details
                    </Dialog.Title>
                    <div className="mt-4 max-h-[calc(90vh-12rem)] overflow-y-auto">
                      {loading ? (
                        <div className="flex justify-center py-8">
                          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                        </div>
                      ) : (
                        <div>
                          {users.admins.length > 0 && renderUserGroup('Administrators', users.admins, true)}
                          {users.agents.length > 0 && renderUserGroup('Agents', users.agents, true)}
                          {users.users.length > 0 && renderUserGroup('Users', users.users)}
                        </div>
                      )}
                    </div>

                    <div className="mt-6">
                      <div className={commonStyles.buttonPrimary.wrapper}>
                        <div className={commonStyles.buttonPrimary.gradient} />
                        <button
                          type="button"
                          className={`${commonStyles.buttonPrimary.content} w-full !py-2`}
                          onClick={onClose}
                        >
                          Close
                        </button>
                      </div>
                    </div>
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