import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://fagsallday.com",
  "https://www.fagsallday.com",
  "https://fagsallday.lovable.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit
    if (!checkRateLimit(user.id)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ghin_number, update_profile } = await req.json();

    if (!ghin_number || !/^\d{5,9}$/.test(ghin_number)) {
      return new Response(JSON.stringify({ error: "Invalid GHIN number. Must be 5-9 digits." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate with GHIN API
    const ghinEmail = Deno.env.get("GHIN_EMAIL");
    const ghinPassword = Deno.env.get("GHIN_PASSWORD");

    if (!ghinEmail || !ghinPassword) {
      return new Response(JSON.stringify({ error: "GHIN credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const loginRes = await fetch("https://api.ghin.com/api/v1/golfer_login.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: { email_or_ghin: ghinEmail, password: ghinPassword, remember_me: true } }),
    });

    if (!loginRes.ok) {
      console.error("GHIN login failed:", loginRes.status);
      return new Response(JSON.stringify({ error: "Failed to authenticate with GHIN" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const loginData = await loginRes.json();
    const ghinToken = loginData?.golfer_user?.golfer_user_token;

    if (!ghinToken) {
      return new Response(JSON.stringify({ error: "Failed to get GHIN auth token" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up golfer by GHIN number
    const searchRes = await fetch(
      `https://api.ghin.com/api/v1/golfers/search.json?golfer_id=${ghin_number}&status=Active`,
      { headers: { Authorization: `Bearer ${ghinToken}` } },
    );

    if (!searchRes.ok) {
      console.error("GHIN search failed:", searchRes.status);
      return new Response(JSON.stringify({ error: "Failed to look up GHIN number" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const searchData = await searchRes.json();
    const golfers = searchData?.golfers;

    if (!golfers || golfers.length === 0) {
      return new Response(JSON.stringify({ error: "No active golfer found with that GHIN number" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const golfer = golfers[0];
    const handicapIndex = parseFloat(golfer.handicap_index);

    if (isNaN(handicapIndex)) {
      return new Response(JSON.stringify({ error: "Golfer has no valid handicap index" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optionally update the user's profile
    if (update_profile) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          handicap_index: handicapIndex,
          ghin_number: ghin_number,
          ghin_last_synced: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("Profile update error:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        handicap_index: handicapIndex,
        golfer_name: `${golfer.first_name || ""} ${golfer.last_name || ""}`.trim(),
        club_name: golfer.club_name || null,
        ghin_number,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sync-ghin-handicap error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
