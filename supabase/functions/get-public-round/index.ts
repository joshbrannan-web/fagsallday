import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { round_id } = await req.json();
    if (!round_id) {
      return new Response(JSON.stringify({ error: "round_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify there's an active pending_round_link for this round (prevents random guessing)
    const { data: pendingLink } = await supabaseAdmin
      .from("pending_round_links")
      .select("id")
      .eq("round_id", round_id)
      .is("claimed_by", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (!pendingLink) {
      return new Response(JSON.stringify({ error: "No active share link found for this round" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch round data
    const { data: round, error: roundError } = await supabaseAdmin
      .from("rounds")
      .select("id, course_data, players_data, scores, status, start_time")
      .eq("id", round_id)
      .single();

    if (roundError || !round) {
      return new Response(JSON.stringify({ error: "Round not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Return only safe fields (strip linkedUserId from players)
    const players = (round.players_data as any[]).map((p: any) => ({
      id: p.id,
      name: p.name,
      handicapIndex: p.handicapIndex,
      tee: p.tee,
    }));

    return new Response(
      JSON.stringify({
        id: round.id,
        course: round.course_data,
        players,
        scores: round.scores,
        status: round.status,
        startTime: round.start_time,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in get-public-round:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
