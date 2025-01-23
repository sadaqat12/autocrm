import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  useEffect(() => {
    const handleInvite = async () => {
      try {
        console.log('Starting invitation acceptance process');
        console.log('Current profile:', profile);
        
        const invitationId = searchParams.get('invitation_id');
        console.log('Invitation ID from URL:', invitationId);
        
        if (!invitationId) {
          throw new Error('Invalid invitation - missing invitation ID');
        }

        if (!profile?.id) {
          console.log('No profile found, redirecting to login');
          navigate('/login', { 
            state: { 
              message: 'Please log in to accept the invitation.' 
            } 
          });
          return;
        }

        // Verify and update the invitation
        const { data: updateData, error: updateError } = await supabase
          .from('organization_users')
          .update({ status: 'accepted' })
          .eq('id', invitationId)
          .eq('user_id', profile.id)
          .eq('status', 'pending')
          .select()
          .single();

        console.log('Update result:', { updateData, error: updateError });

        if (updateError) {
          throw updateError;
        }

        // Redirect to dashboard
        navigate('/dashboard');
      } catch (err: any) {
        console.error('Error accepting invitation:', err);
        navigate('/dashboard', { 
          state: { 
            error: err.message || 'Failed to accept invitation. Please try again.' 
          } 
        });
      }
    };

    handleInvite();
  }, [searchParams, navigate, profile?.id]);

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