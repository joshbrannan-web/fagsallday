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
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { entry_id } = await req.json();
    if (!entry_id) {
      return new Response(JSON.stringify({ error: "Missing entry_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: entry, error: entryError } = await adminClient
      .from("tournament_registration_entries")
      .select(`id, sheet_row_index, tournament_registration_configs ( id, created_by, google_sheet_id, google_refresh_token )`)
      .eq("id", entry_id)
      .single();

    if (entryError || !entry) {
      return new Response(JSON.stringify({ error: "Entry not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const config = (entry as any).tournament_registration_configs;
    if (config?.created_by !== user.id) {
      return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Delete Google Sheet row and update indices for rows below it
    if (config?.google_sheet_id && config?.google_refresh_token && entry.sheet_row_index) {
      try {
        const accessToken = await getAccessTokenFromRefresh(config.google_refresh_token);
        const rowIndex = entry.sheet_row_index;

        // Delete the row (startIndex is 0-based, endIndex exclusive)
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${config.google_sheet_id}:batchUpdate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [{
              deleteDimension: {
                range: { sheetId: 0, dimension: "ROWS", startIndex: rowIndex - 1, endIndex: rowIndex },
              },
            }],
          }),
        });

        // Shift sheet_row_index down by 1 for all entries in this config that were below the deleted row
        await adminClient.rpc("decrement_sheet_row_index", {
          p_config_id: config.id,
          p_above_row: rowIndex,
        });
      } catch (sheetErr) {
        console.error("Sheet row deletion failed (non-fatal):", sheetErr);
      }
    }

    // Delete the entry from the database
    await adminClient.from("tournament_registration_entries").delete().eq("id", entry_id);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
