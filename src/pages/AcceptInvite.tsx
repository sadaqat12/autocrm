import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const handleInvite = async () => {
      try {
        // Get the invite token from the URL
        const token = searchParams.get('token');
        if (!token) {
          throw new Error('Invalid invitation link');
        }

        // Let Supabase handle the invitation
        const { error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'invite'
        });

        if (error) throw error;

        // Redirect to login with success message
        navigate('/login', { 
          state: { 
            message: 'Invitation accepted successfully. Please log in to continue.' 
          } 
        });
      } catch (err: any) {
        console.error('Error accepting invitation:', err);
        navigate('/login', { 
          state: { 
            error: err.message || 'Failed to accept invitation. Please contact support.' 
          } 
        });
      }
    };

    handleInvite();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Processing Invitation
        </h2>
        <div className="mt-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    </div>
  );
} 