import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { lookupGhinHandicap } from "../_shared/ghin.ts";

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

    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const configId = String(body?.config_id || "").trim();
    if (!configId) {
      return new Response(JSON.stringify({ error: "Missing config_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: config } = await admin
      .from("tournament_registration_configs")
      .select("id, created_by")
      .eq("id", configId)
      .maybeSingle();
    if (!config) {
      return new Response(JSON.stringify({ error: "Config not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (config.created_by !== user.id) {
      return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: entries } = await admin
      .from("tournament_registration_entries")
      .select("id, ghin_number, handicap_index, user_id")
      .eq("config_id", configId)
      .not("ghin_number", "is", null)
      .is("handicap_index", null);

    let updated = 0;
    const failed: string[] = [];

    for (const entry of entries ?? []) {
      const hcp = await lookupGhinHandicap(entry.ghin_number as string);
      if (hcp === null) {
        failed.push(entry.ghin_number as string);
        continue;
      }
      await admin.from("tournament_registration_entries").update({ handicap_index: hcp }).eq("id", entry.id);
      if (entry.user_id) {
        await admin
          .from("profiles")
          .update({ handicap_index: hcp, ghin_number: entry.ghin_number, ghin_last_synced: new Date().toISOString() })
          .eq("id", entry.user_id);
      }
      updated++;
    }

    return new Response(JSON.stringify({ success: true, checked: entries?.length ?? 0, updated, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("backfill-registration-handicaps error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
