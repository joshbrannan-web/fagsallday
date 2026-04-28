import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: caller must be admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: corsHeaders });
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: any) => r.role === "admin")) {
      return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: corsHeaders });
    }

    // GHIN login
    const loginRes = await fetch("https://api2.ghin.com/api/v1/golfer_login.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: { email_or_ghin: Deno.env.get("GHIN_EMAIL"), password: Deno.env.get("GHIN_PASSWORD"), remember_me: true },
        token: "123",
      }),
    });
    const loginData = await loginRes.json();
    const ghinToken = loginData?.golfer_user?.golfer_user_token;
    if (!ghinToken) return new Response(JSON.stringify({ error: "GHIN login failed" }), { status: 502, headers: corsHeaders });

    // Pull profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, ghin_number, handicap_index, ghin_last_synced")
      .not("ghin_number", "is", null);

    const extractIds = (g: any): string[] =>
      [g?.golfer_id, g?.ghin_no, g?.ghin_number, g?.GHINNumber, g?.ghin, g?.id]
        .filter((v) => v !== undefined && v !== null)
        .map((v) => String(v).trim());

    const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z]/g, "");

    const results: any[] = [];
    for (const p of profiles || []) {
      const requestedId = String(p.ghin_number).trim();
      try {
        const sr = await fetch(
          `https://api2.ghin.com/api/v1/golfers/search.json?golfer_id=${requestedId}&status=Active&per_page=10&page=1`,
          { headers: { Authorization: `Bearer ${ghinToken}` } },
        );
        if (!sr.ok) {
          results.push({ name: p.display_name, ghin: requestedId, status: "API_ERROR", detail: sr.status });
          continue;
        }
        const sd = await sr.json();
        const golfers: any[] = sd?.golfers || [];
        const exact = golfers.find((g) => extractIds(g).includes(requestedId));
        if (!exact) {
          results.push({
            name: p.display_name,
            ghin: requestedId,
            status: "NOT_FOUND",
            stored_hcp: p.handicap_index,
            ghin_hcp: null,
            ghin_name: null,
            looseCandidates: golfers.slice(0, 3).map((g) => `${g.first_name} ${g.last_name} (${extractIds(g).join("/")})`),
          });
          continue;
        }
        const ghinName = `${exact.first_name || ""} ${exact.last_name || ""}`.trim();
        const ghinHcp = parseFloat(exact.handicap_index);
        const storedName = norm(p.display_name || "");
        const fetchedName = norm(ghinName);
        const nameTokensProfile = (p.display_name || "").toLowerCase().split(/\s+/).filter(Boolean);
        const nameMatch =
          storedName === fetchedName ||
          nameTokensProfile.some((t) => fetchedName.includes(norm(t))) ||
          fetchedName.split(/\s+/).some((t: string) => storedName.includes(norm(t)));

        let status = "OK";
        if (!nameMatch) status = "NAME_MISMATCH";
        else if (isNaN(ghinHcp)) status = "NO_HCP";
        else if (Math.abs(ghinHcp - Number(p.handicap_index)) > 0.1) status = "HCP_DRIFT";

        results.push({
          name: p.display_name,
          ghin: requestedId,
          status,
          stored_hcp: p.handicap_index,
          ghin_hcp: isNaN(ghinHcp) ? null : ghinHcp,
          ghin_name: ghinName,
          club: exact.club_name || null,
          last_synced: p.ghin_last_synced,
        });
      } catch (e) {
        results.push({ name: p.display_name, ghin: requestedId, status: "EXCEPTION", detail: String(e) });
      }
    }

    return new Response(JSON.stringify({ count: results.length, results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
