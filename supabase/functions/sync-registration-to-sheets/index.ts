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
  if (!tokenData.access_token) throw new Error("Failed to refresh access token");
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { config_id, entry } = await req.json();
    if (!config_id || !entry) {
      return new Response(JSON.stringify({ error: "Missing config_id or entry" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: config } = await supabase
      .from("tournament_registration_configs")
      .select("google_sheet_id, google_refresh_token")
      .eq("id", config_id)
      .single();

    if (!config?.google_sheet_id) {
      return new Response(JSON.stringify({ skipped: true, reason: "No sheet configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config.google_refresh_token) {
      return new Response(JSON.stringify({ skipped: true, reason: "No Google auth token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessTokenFromRefresh(config.google_refresh_token);

    const row = [
      entry.full_name || "",
      entry.email || "",
      entry.phone || "",
      entry.handicap_index != null ? String(entry.handicap_index) : "",
      entry.ghin_number || "",
      entry.payment_amount != null ? String(entry.payment_amount) : "",
      entry.payment_confirmed ? "Yes" : "No",
      new Date().toISOString(),
    ];

    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${config.google_sheet_id}/values/Registrations!A:H:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [row] }),
      }
    );

    const appendData = await appendRes.json();
    if (!appendRes.ok) {
      console.error("Sheet append failed:", JSON.stringify(appendData));
      return new Response(JSON.stringify({ error: "Failed to append to sheet" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
