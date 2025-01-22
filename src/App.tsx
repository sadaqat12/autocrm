import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import AdminDashboard from './pages/dashboards/AdminDashboard';
import AgentDashboard from './pages/dashboards/AgentDashboard';
import UserDashboard from './pages/dashboards/UserDashboard';
import OrganizationDetails from './pages/OrganizationDetails';
import TicketDetails from './pages/TicketDetails';
import { useAuth } from './lib/AuthContext';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import AcceptInvite from './pages/AcceptInvite';
import { supabase } from './lib/supabase';

// Auth callback handler
function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Log all URL information for debugging
        console.log('Full URL:', window.location.href);
        console.log('Search params:', Object.fromEntries(searchParams.entries()));
        console.log('Location state:', location);
        console.log('Hash:', window.location.hash);

        // First try to get the token from the hash fragment
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const hashToken = hashParams.get('access_token');

        if (hashToken) {
          // Handle access token from hash
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) throw error;

          if (session?.user?.user_metadata?.pending_profile) {
            const { error: profileError } = await supabase
              .from('profiles')
              .insert([
                {
                  id: session.user.id,
                  full_name: session.user.user_metadata.full_name,
                  phone: session.user.user_metadata.phone,
                  role: 'user'
                }
              ]);
            
            if (profileError) {
              console.error('Error creating profile:', profileError);
              throw new Error('Failed to create user profile');
            }
          }

          navigate('/login', {
            state: {
              message: 'Email confirmed successfully. Please sign in to continue.'
            }
          });
          return;
        }

        // Check for email confirmation token in query params
        const token = searchParams.get('token_hash') || searchParams.get('token') || searchParams.get('confirmation_token');
        if (token) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'email'
          });
          if (error) throw error;

          // After email verification, get the session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;

          // Check if we need to create a profile
          if (session?.user?.user_metadata?.pending_profile) {
            const { error: profileError } = await supabase
              .from('profiles')
              .insert([
                {
                  id: session.user.id,
                  full_name: session.user.user_metadata.full_name,
                  phone: session.user.user_metadata.phone,
                  role: 'user'
                }
              ]);
            
            if (profileError) {
              console.error('Error creating profile:', profileError);
              throw new Error('Failed to create user profile');
            }
          }

          navigate('/login', {
            state: {
              message: 'Email confirmed successfully. Please sign in to continue.'
            }
          });
          return;
        }

        // Check for OAuth code flow
        const code = searchParams.get('code') || searchParams.get('refresh_token');
        if (code) {
          const { data: { session }, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
          if (sessionError) throw sessionError;

          // Check if we need to create a profile
          if (session?.user?.user_metadata?.pending_profile) {
            const { error: profileError } = await supabase
              .from('profiles')
              .insert([
                {
                  id: session.user.id,
                  full_name: session.user.user_metadata.full_name,
                  phone: session.user.user_metadata.phone,
                  role: 'user'
                }
              ]);
            
            if (profileError) {
              console.error('Error creating profile:', profileError);
              throw new Error('Failed to create user profile');
            }
          }

          navigate('/login', {
            state: {
              message: 'Email confirmed successfully. Please sign in to continue.'
            }
          });
          return;
        }

        throw new Error('No valid authentication parameters found in URL');
      } catch (err) {
        console.error('Error in auth callback:', err);
        navigate('/login', {
          state: {
            error: 'Failed to verify email. Please try again or contact support.'
          }
        });
      }
    };

    handleCallback();
  }, [searchParams, navigate, location]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
}

// Wrapper for OrganizationDetails to handle params
function OrganizationDetailsWrapper() {
  const { id } = useParams();
  const [organization, setOrganization] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrganization() {
      if (!id) return;

      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (data) {
          setOrganization(data);
        }
      } catch (error) {
        console.error('Error fetching organization:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrganization();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!organization) {
    return <Navigate to="/dashboard" replace />;
  }

  return <OrganizationDetails organization={organization} />;
}

// Separate component for routes to ensure proper context usage
function AuthenticatedRoutes() {
  const { profile } = useAuth();

  // Redirect to the appropriate dashboard based on user role
  const getDashboardRoute = () => {
    if (!profile) return '/login';
    
    switch (profile.role) {
      case 'admin':
        return '/admin';
      case 'agent':
        return '/agent';
      case 'user':
        return '/dashboard';
      default:
        return '/login';
    }
  };

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['user']}>
            <UserDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/agent"
        element={
          <ProtectedRoute allowedRoles={['agent']}>
            <AgentDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/organization/:id"
        element={
          <ProtectedRoute allowedRoles={['admin', 'agent']}>
            <OrganizationDetailsWrapper />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ticket/:ticketId"
        element={
          <ProtectedRoute allowedRoles={['admin', 'agent', 'user']}>
            <TicketDetails />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to={getDashboardRoute()} replace />} />
      <Route path="*" element={<Navigate to={getDashboardRoute()} replace />} />
    </Routes>
  );
}

// Main App component
export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AuthenticatedRoutes />
      </AuthProvider>
    </Router>
  );
}
