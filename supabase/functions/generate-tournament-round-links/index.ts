import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRODUCTION_URL = "https://fagsallday.com";

interface TeeTime {
  scorekeeper_user_id: string | null;
  player_ids: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { tournament_id, round_id, tee_times } = await req.json() as {
      tournament_id: string;
      round_id: string;
      tee_times: TeeTime[];
    };

    if (!tournament_id || !round_id) {
      return new Response(JSON.stringify({ error: "tournament_id and round_id are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify caller is tournament creator
    const { data: tournament, error: tError } = await supabaseUser
      .from("tournaments")
      .select("id, creator_id, name")
      .eq("id", tournament_id)
      .single();

    if (tError || !tournament) {
      return new Response(JSON.stringify({ error: "Tournament not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (tournament.creator_id !== userId) {
      return new Response(JSON.stringify({ error: "Only the tournament creator can generate links" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get round info
    const { data: round, error: rError } = await supabaseUser
      .from("tournament_rounds")
      .select("id, round_number, course_data")
      .eq("id", round_id)
      .single();

    if (rError || !round) {
      return new Response(JSON.stringify({ error: "Round not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const courseName = (round.course_data as any)?.name || "the course";

    // Get tournament players for name lookup
    const { data: tPlayers } = await supabaseUser
      .from("tournament_players")
      .select("id, user_id, player_name")
      .eq("tournament_id", tournament_id);

    const playerMap = new Map((tPlayers || []).map(p => [p.id, p]));

    // Admin client for magic link generation
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const links: { playerName: string; link: string; groupIndex: number }[] = [];

    for (let gi = 0; gi < (tee_times || []).length; gi++) {
      const tt = tee_times[gi];
      if (!tt.scorekeeper_user_id) continue;

      // Find the scorekeeper's player record
      const skPlayer = (tPlayers || []).find(p => p.id === tt.scorekeeper_user_id);
      if (!skPlayer || !skPlayer.user_id) continue;

      // Generate magic link for scorekeeper
      try {
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(skPlayer.user_id);
        if (userError || !userData?.user?.email) continue;

        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: userData.user.email,
          options: {
            redirectTo: `${PRODUCTION_URL}/#/tournament/${tournament_id}/round/${round_id}`,
          },
        });

        if (linkError || !linkData?.properties?.action_link) continue;

        // Set this player as scorekeeper on the round
        await supabaseAdmin
          .from("tournament_rounds")
          .update({ scorekeeper_id: skPlayer.user_id })
          .eq("id", round_id);

        links.push({
          playerName: skPlayer.player_name,
          link: linkData.properties.action_link,
          groupIndex: gi + 1,
        });
      } catch (err) {
        console.error(`Error generating link for ${skPlayer.player_name}:`, err);
      }
    }

    // Build share text
    let shareText = `🏌️ ${tournament.name} — Round ${round.round_number} at ${courseName}\n`;
    shareText += `Score entry links:\n`;

    for (const link of links) {
      shareText += `\n${link.playerName} (Group ${link.groupIndex}):\n${link.link}\n`;
    }

    if (links.length === 0) {
      shareText += "\nNo scorekeeper links were generated. Make sure scorekeepers have linked accounts.";
    }

    return new Response(
      JSON.stringify({ shareText, links }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in generate-tournament-round-links:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
