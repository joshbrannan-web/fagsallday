import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getAccessTokenFromRefresh(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Failed to refresh Google token");
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { config_id } = await req.json();
    if (!config_id || typeof config_id !== "string") {
      return new Response(JSON.stringify({ error: "Missing config_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: config, error: cfgErr } = await adminClient
      .from("tournament_registration_configs")
      .select("id, created_by, google_sheet_id, google_refresh_token")
      .eq("id", config_id)
      .maybeSingle();

    if (cfgErr || !config) {
      return new Response(JSON.stringify({ error: "Config not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorize: creator or app admin
    let authorized = config.created_by === user.id;
    if (!authorized) {
      const { data: roleRow } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      authorized = !!roleRow;
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Best-effort: delete the linked Google Sheet from Drive
    if (config.google_sheet_id && config.google_refresh_token) {
      try {
        const accessToken = await getAccessTokenFromRefresh(config.google_refresh_token);
        const driveRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${config.google_sheet_id}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!driveRes.ok && driveRes.status !== 404) {
          const text = await driveRes.text();
          console.warn("Drive delete returned", driveRes.status, text);
        }
      } catch (sheetErr) {
        console.error("Sheet deletion failed (non-fatal):", sheetErr);
      }
    }

    // Delete all entries, then the config itself
    const { error: entriesErr } = await adminClient
      .from("tournament_registration_entries")
      .delete()
      .eq("config_id", config_id);
    if (entriesErr) throw entriesErr;

    const { error: cfgDelErr } = await adminClient
      .from("tournament_registration_configs")
      .delete()
      .eq("id", config_id);
    if (cfgDelErr) throw cfgDelErr;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String((err as Error)?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
