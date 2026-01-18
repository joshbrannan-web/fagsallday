import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the current user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin using RPC
    const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use admin client to fetch all users
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get all auth users
    const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers();
    if (authError) {
      throw authError;
    }

    // Get all profiles (admin can see all via RLS)
    const { data: profiles, error: profilesError } = await userClient
      .from("profiles")
      .select("*");
    if (profilesError) {
      throw profilesError;
    }

    // Get round counts per user
    const { data: rounds, error: roundsError } = await userClient
      .from("rounds")
      .select("user_id");
    if (roundsError) {
      throw roundsError;
    }

    // Count rounds per user
    const roundCounts: Record<string, number> = {};
    rounds?.forEach((r) => {
      roundCounts[r.user_id] = (roundCounts[r.user_id] || 0) + 1;
    });

    // Merge data
    const users = authUsers.users.map((authUser) => {
      const profile = profiles?.find((p) => p.id === authUser.id);
      return {
        id: authUser.id,
        email: authUser.email,
        display_name: profile?.display_name || authUser.user_metadata?.display_name || "Unknown",
        handicap_index: profile?.handicap_index || 0,
        created_at: authUser.created_at,
        rounds_count: roundCounts[authUser.id] || 0,
      };
    });

    return new Response(
      JSON.stringify({ users }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in admin-list-users:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
