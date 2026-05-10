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
  if (!tokenData.access_token) throw new Error("Failed to refresh access token");
  return tokenData.access_token;
}

const HEADERS = ["Entry ID","Status","Full Name","Email","Phone","Handicap Index","GHIN #","Payment Amount","Payment Confirmed","Registered At"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { title, config_id } = await req.json();
    if (!title || !config_id) return new Response(JSON.stringify({ error: "Missing title or config_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: config } = await adminClient.from("tournament_registration_configs").select("google_refresh_token, created_by").eq("id", config_id).single();
    if (!config || config.created_by !== user.id) return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!config.google_refresh_token) return new Response(JSON.stringify({ error: "Google Sheets not connected." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const accessToken = await getAccessTokenFromRefresh(config.google_refresh_token);
    const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties: { title: `${title} - Registrations` }, sheets: [{ properties: { title: "Registrations", sheetId: 0 }, data: [{ startRow: 0, startColumn: 0, rowData: [{ values: HEADERS.map((v) => ({ userEnteredValue: { stringValue: v }, userEnteredFormat: { textFormat: { bold: true } } })) }] }] }] }),
    });
    const sheetData = await createRes.json();
    if (!sheetData.spreadsheetId) return new Response(JSON.stringify({ error: "Failed to create sheet" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetData.spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ requests: [{ updateDimensionProperties: { range: { sheetId: 0, dimension: "COLUMNS", startIndex: 0, endIndex: 1 }, properties: { hiddenByUser: true }, fields: "hiddenByUser" } }] }),
    });
    await adminClient.from("tournament_registration_configs").update({ google_sheet_id: sheetData.spreadsheetId, google_sheet_url: sheetData.spreadsheetUrl }).eq("id", config_id);
    return new Response(JSON.stringify({ sheet_id: sheetData.spreadsheetId, sheet_url: sheetData.spreadsheetUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
