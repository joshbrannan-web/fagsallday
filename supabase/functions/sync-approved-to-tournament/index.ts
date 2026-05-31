import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { config_id } = await req.json();
    if (!config_id) {
      return new Response(JSON.stringify({ error: "Missing config_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: config, error: configErr } = await adminClient
      .from("tournament_registration_configs")
      .select("id, created_by, tournament_id")
      .eq("id", config_id)
      .single();

    if (configErr || !config) {
      return new Response(JSON.stringify({ error: "Config not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (config.created_by !== user.id) {
      return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!config.tournament_id) {
      return new Response(JSON.stringify({ error: "No tournament linked" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: approved } = await adminClient
      .from("tournament_registration_entries")
      .select("id, full_name, handicap_index, user_id")
      .eq("config_id", config_id)
      .eq("status", "approved");

    let added = 0;
    let skipped = 0;

    for (const entry of approved ?? []) {
      const { data: existing } = await adminClient
        .from("tournament_players")
        .select("id")
        .eq("tournament_id", config.tournament_id)
        .eq("display_name", entry.full_name)
        .maybeSingle();
      if (existing) {
        skipped++;
      } else {
        await adminClient.from("tournament_players").insert({
          tournament_id: config.tournament_id,
          display_name: entry.full_name,
          handicap_index: entry.handicap_index ?? 0,
          user_id: entry.user_id ?? null,
        });
        added++;
      }
    }

    return new Response(JSON.stringify({ success: true, added, skipped }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("sync error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
