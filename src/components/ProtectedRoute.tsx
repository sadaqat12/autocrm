import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { UserRole } from '../lib/supabase';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    // Redirect to the appropriate dashboard based on user role
    const dashboardRoutes: Record<UserRole, string> = {
      admin: '/admin',
      agent: '/agent',
      user: '/dashboard'
    };
    return <Navigate to={dashboardRoutes[profile.role]} />;
  }

  return <>{children}</>;
} 