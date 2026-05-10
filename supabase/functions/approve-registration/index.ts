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

async function updateSheetCell(accessToken: string, sheetId: string, rowIndex: number, colIndex: number, value: string): Promise<void> {
  const colLetter = String.fromCharCode(65 + colIndex);
  const range = `Registrations!${colLetter}${rowIndex}`;
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [[value]] }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { entry_id, action } = await req.json();
    if (!entry_id || !action || !["approve", "reject"].includes(action)) return new Response(JSON.stringify({ error: "Missing entry_id or invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: entry, error: entryError } = await adminClient.from("tournament_registration_entries").select(`id, full_name, email, handicap_index, user_id, status, sheet_row_index, tournament_registration_configs ( id, tournament_id, created_by, google_sheet_id, google_refresh_token )`).eq("id", entry_id).single();
    if (entryError || !entry) return new Response(JSON.stringify({ error: "Entry not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const config = (entry as any).tournament_registration_configs;
    if (config?.created_by !== user.id) return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (entry.status === (action === "approve" ? "approved" : "rejected")) return new Response(JSON.stringify({ success: true, already_processed: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    let tournamentPlayerId: string | null = null;
    if (action === "approve") {
      if (config?.tournament_id) {
        const { data: existing } = await adminClient.from("tournament_players").select("id").eq("tournament_id", config.tournament_id).eq("display_name", entry.full_name).maybeSingle();
        if (!existing) {
          const { data: newPlayer } = await adminClient.from("tournament_players").insert({ tournament_id: config.tournament_id, display_name: entry.full_name, handicap_index: entry.handicap_index ?? 0, user_id: entry.user_id ?? null }).select("id").single();
          tournamentPlayerId = newPlayer?.id ?? null;
        } else {
          tournamentPlayerId = existing.id;
        }
      }
      await adminClient.from("tournament_registration_entries").update({ status: "approved", approved_at: new Date().toISOString(), approved_by: user.id }).eq("id", entry_id);
    } else {
      await adminClient.from("tournament_registration_entries").update({ status: "rejected", approved_at: new Date().toISOString(), approved_by: user.id }).eq("id", entry_id);
    }
    if (config?.google_sheet_id && config?.google_refresh_token && entry.sheet_row_index) {
      try {
        const accessToken = await getAccessTokenFromRefresh(config.google_refresh_token);
        await updateSheetCell(accessToken, config.google_sheet_id, entry.sheet_row_index, 1, action === "approve" ? "Player" : "Rejected");
      } catch (sheetErr) {
        console.error("Sheet update failed (non-fatal):", sheetErr);
      }
    }
    return new Response(JSON.stringify({ success: true, tournament_player_id: tournamentPlayerId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
