import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRODUCTION_URL = "https://fagsallday.com";

interface PlayerData {
  id: string;
  name: string;
  linkedUserId?: string;
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

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const userId = user.id;

    const { round_id } = await req.json();
    if (!round_id) {
      return new Response(JSON.stringify({ error: "round_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify caller is round owner and get round data
    const { data: round, error: roundError } = await supabaseUser
      .from("rounds")
      .select("id, user_id, players_data, course_data")
      .eq("id", round_id)
      .single();

    if (roundError || !round) {
      return new Response(JSON.stringify({ error: "Round not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (round.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Only the round owner can generate share links" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const players = round.players_data as PlayerData[];
    const courseData = round.course_data as { name?: string };
    const courseName = courseData?.name || "the course";

    // Admin client for magic link generation and pending_round_links insertion
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const links: { playerName: string; link: string; type: "magic" | "invite" }[] = [];

    for (const player of players) {
      // Skip the round owner
      if (player.linkedUserId === userId) continue;

      if (player.linkedUserId) {
        // Linked player — generate magic link
        try {
          const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(player.linkedUserId);
          if (userError || !userData?.user?.email) {
            console.error(`Failed to get user for ${player.name}:`, userError);
            continue;
          }

          const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email: userData.user.email,
            options: {
              redirectTo: `${PRODUCTION_URL}/?redirect=scorecard`,
            },
          });

          if (linkError || !linkData?.properties?.action_link) {
            console.error(`Failed to generate magic link for ${player.name}:`, linkError);
            continue;
          }

          links.push({
            playerName: player.name,
            link: linkData.properties.action_link,
            type: "magic",
          });
        } catch (err) {
          console.error(`Error generating link for ${player.name}:`, err);
        }
      } else {
        // Unlinked player — generate invite URL and insert pending_round_links row
        const inviteUrl = `${PRODUCTION_URL}/#/round-access/${round_id}?player_name=${encodeURIComponent(player.name)}`;

        // Insert pending round link using admin client to bypass RLS
        await supabaseAdmin.from("pending_round_links").insert({
          round_id,
          player_name: player.name,
          owner_user_id: userId,
        });

        links.push({
          playerName: player.name,
          link: inviteUrl,
          type: "invite",
        });
      }
    }

    // Build share text
    let shareText = `🏌️ Round started at ${courseName}!\n`;

    for (const link of links) {
      if (link.type === "magic") {
        shareText += `\n${link.playerName}, tap to view the live scorecard:\n${link.link}\n`;
      } else {
        shareText += `\n${link.playerName}, join us on F&Gs All Day:\n${link.link}\n`;
      }
    }

    return new Response(
      JSON.stringify({ shareText, links }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in generate-round-links:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
