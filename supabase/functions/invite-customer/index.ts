import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

    // Get the current user's session
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse the request body first
    const { email, fullName, organizationId } = await req.json()

    if (!email || !fullName || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get the JWT token from the Authorization header
    const token = authHeader.replace('Bearer ', '')
    
    // Verify the token and get the user
    const { data: { user: currentUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !currentUser) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get the current user's profile to check permissions
    const { data: currentProfile, error: currentProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id')
      .eq('id', currentUser.id)
      .single()

    if (currentProfileError || !currentProfile) {
      console.error('Error fetching current user profile:', currentProfileError)
      return new Response(
        JSON.stringify({ error: 'Error verifying permissions' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if user has permission to invite (must be owner or admin of the organization)
    if (
      currentProfile.role !== 'owner' && 
      currentProfile.role !== 'admin' || 
      currentProfile.organization_id !== organizationId
    ) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions to invite users' }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if user already exists
    const { data: { users }, error: authUserError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authUserError) {
      console.error('Error checking existing auth user:', authUserError)
      return new Response(
        JSON.stringify({ error: 'Error checking existing user' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const existingAuthUser = users?.find(user => user.email === email)

    if (existingAuthUser) {
      // Check if user already has access to this organization
      const { data: existingProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('id', existingAuthUser.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error checking existing profile:', profileError)
        return new Response(
          JSON.stringify({ error: 'Error checking existing access' }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      if (existingProfile) {
        return new Response(
          JSON.stringify({ error: 'User already has access to this organization' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // Create user with Supabase Auth if they don't exist
    const { data: authUser, error: signUpError } = existingAuthUser ? 
      { data: { user: existingAuthUser }, error: null } :
      await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName }
      })

    if (signUpError) {
      console.error('Error creating user:', signUpError)
      return new Response(
        JSON.stringify({ error: signUpError.message || 'Failed to create user account' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([
        {
          id: authUser.user.id,
          organization_id: organizationId,
          full_name: fullName,
          role: 'customer'
        }
      ])

    if (profileError) {
      console.error('Error creating profile:', profileError)
      // Clean up the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      return new Response(
        JSON.stringify({ error: 'Failed to create user profile' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ message: 'User invited successfully' }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 