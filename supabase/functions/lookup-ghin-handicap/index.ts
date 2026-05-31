// Public GHIN lookup (no auth) for tournament registration page.
// Returns handicap_index for a given GHIN number without touching the DB.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Rate limit by client IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 15;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    if (!checkRateLimit(ip)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const ghin_number = String(body?.ghin_number || "").trim();

    if (!ghin_number || !/^\d{5,9}$/.test(ghin_number)) {
      return new Response(JSON.stringify({ error: "Invalid GHIN number. Must be 5-9 digits." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ghinEmail = Deno.env.get("GHIN_EMAIL");
    const ghinPassword = Deno.env.get("GHIN_PASSWORD");

    if (!ghinEmail || !ghinPassword) {
      return new Response(JSON.stringify({ error: "GHIN credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const loginRes = await fetch("https://api2.ghin.com/api/v1/golfer_login.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: { email_or_ghin: ghinEmail, password: ghinPassword, remember_me: true }, token: "123" }),
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

    const searchRes = await fetch(
      `https://api2.ghin.com/api/v1/golfers/search.json?golfer_id=${ghin_number}&status=Active&per_page=10&page=1`,
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
    const golfers: any[] = searchData?.golfers || [];

    const extractIds = (g: any): string[] =>
      [g?.golfer_id, g?.ghin_no, g?.ghin_number, g?.GHINNumber, g?.ghin, g?.id]
        .filter((v) => v !== undefined && v !== null)
        .map((v) => String(v).trim());

    const golfer = golfers.find((g: any) => extractIds(g).includes(ghin_number));
    if (!golfer) {
      return new Response(JSON.stringify({ error: "No active golfer found with that GHIN number" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const handicapIndex = parseFloat(golfer.handicap_index);
    if (isNaN(handicapIndex)) {
      return new Response(JSON.stringify({ error: "Golfer has no valid handicap index" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
    console.error("lookup-ghin-handicap error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
