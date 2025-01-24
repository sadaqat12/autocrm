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
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import AcceptInvite from './pages/AcceptInvite';
import { supabase } from './lib/supabase';
import { Organization } from './lib/types';
import AddAgent from './pages/AddAgent';
import AssignAgents from './pages/AssignAgents';

// Auth callback handler
function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the hash from the URL
        const hash = location.hash;
        console.log('Processing auth callback with hash:', hash);

        if (!hash) {
          throw new Error('No valid authentication parameters found in URL');
        }

        // Parse the hash parameters
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');

        console.log('Auth type:', type);

        if (!accessToken) {
          throw new Error('No access token found in URL');
        }

        // For signup flow, just redirect to login
        if (type === 'signup') {
          console.log('Email confirmed, redirecting to login');
          // Clear any existing session
          await supabase.auth.signOut();
          navigate('/login', {
            state: {
              message: 'Email confirmed successfully. Please sign in to continue.'
            }
          });
        } else if (type === 'recovery') {
          console.log('Password reset successful');
          // Clear any existing session
          await supabase.auth.signOut();
          navigate('/login', {
            state: {
              message: 'Password reset successful. Please sign in with your new password.'
            }
          });
        } else {
          console.log('Unknown callback type, redirecting to login');
          // Clear any existing session
          await supabase.auth.signOut();
          navigate('/login');
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        navigate('/login', {
          state: {
            error: err instanceof Error ? err.message : 'Authentication failed. Please try again.'
          }
        });
      } finally {
        setIsProcessing(false);
      }
    };

    handleCallback();
  }, [navigate, location]);

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return null;
}

// Wrapper for OrganizationDetails to handle params
function OrganizationDetailsWrapper() {
  const { id } = useParams();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrganization() {
      if (!id) return;

      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('id, name, created_at')
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
        path="/add-agent"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AddAgent />
          </ProtectedRoute>
        }
      />

      <Route
        path="/assign-agents/:orgId"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AssignAgents />
          </ProtectedRoute>
        }
      />

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
