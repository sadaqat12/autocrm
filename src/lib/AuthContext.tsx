import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, UserProfile } from './supabase';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, phone: string, organizationName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        handleUserSession(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        handleUserSession(session.user);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleUserSession = async (user: User) => {
    try {
      // First try to fetch existing profile
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching profile:', fetchError);
        throw fetchError;
      }

      if (existingProfile) {
        console.log('Found existing profile');
        setProfile(existingProfile);
        setLoading(false);
        return;
      }

      // No profile exists, create one
      console.log('No profile found, creating new profile for user:', user.id);
      
      // Try direct insert first (now that we have the proper RLS policy)
      const { data: insertData, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          full_name: user.user_metadata.full_name || '',
          phone: user.user_metadata.phone || '',
          role: 'user',
          metadata: {
            email: user.email,
            email_verified: user.user_metadata?.email_verified || false
          }
        })
        .select()
        .single();

      if (insertError) {
        console.error('Profile creation failed:', insertError);
        // If direct insert fails, try the RPC method as fallback
        console.log('Direct insert failed, trying RPC method');
        const { error: rpcError } = await supabase.rpc('create_profile', {
          user_id: user.id,
          user_full_name: user.user_metadata.full_name || '',
          user_phone: user.user_metadata.phone || '',
          user_metadata: {
            email: user.email,
            email_verified: user.user_metadata?.email_verified || false
          }
        });

        if (rpcError) {
          console.error('RPC profile creation failed:', rpcError);
          throw rpcError;
        }

        // After RPC call, fetch the newly created profile
        const { data: newProfile, error: refetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (refetchError) {
          console.error('Error fetching new profile:', refetchError);
          throw refetchError;
        }

        console.log('Profile created successfully via RPC');
        setProfile(newProfile);
      } else {
        console.log('Profile created successfully via direct insert');
        setProfile(insertData);
      }
    } catch (error) {
      console.error('Error in handleUserSession:', error);
      // Sign out the user if there's an error
      await supabase.auth.signOut();
      throw new Error('Failed to create user profile. Please try logging in again.');
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string, phone: string, organizationName: string) => {
    // Get the current URL's origin, fallback to localhost if not available
    const redirectTo = typeof window !== 'undefined' 
      ? `${window.location.origin}/auth/callback`
      : 'http://localhost:3000/auth/callback';

    console.log('Signup redirect URL:', redirectTo);

    const { data: authData, error: authError } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: fullName,
          phone: phone,
          email: email
        }
      }
    });
    if (authError) throw authError;

    // Log the response for debugging
    console.log('Signup response:', {
      user: authData.user,
      session: authData.session
    });
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 