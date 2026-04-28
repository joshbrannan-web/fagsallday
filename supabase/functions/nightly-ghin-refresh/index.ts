import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const extractIds = (g: any): string[] =>
  [g?.golfer_id, g?.ghin_no, g?.ghin_number, g?.GHINNumber, g?.ghin, g?.id]
    .filter((v) => v !== undefined && v !== null)
    .map((v) => String(v).trim());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Auth: caller must present the service-role key (used by pg_cron + manual admin runs)
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.replace("Bearer ", "").trim() !== serviceRole) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRole);

    // GHIN login (shared account)
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
      body: JSON.stringify({
        user: { email_or_ghin: ghinEmail, password: ghinPassword, remember_me: true },
        token: "123",
      }),
    });
    if (!loginRes.ok) {
      console.error("GHIN login failed:", loginRes.status);
      return new Response(JSON.stringify({ error: "GHIN login failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const loginData = await loginRes.json();
    const ghinToken = loginData?.golfer_user?.golfer_user_token;
    if (!ghinToken) {
      return new Response(JSON.stringify({ error: "No GHIN token" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull all profiles with a GHIN number
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, display_name, ghin_number, handicap_index")
      .not("ghin_number", "is", null);

    if (profErr) {
      console.error("Profile fetch error:", profErr);
      return new Response(JSON.stringify({ error: "Failed to fetch profiles" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const summary = {
      total: profiles?.length || 0,
      updated: 0,
      unchanged: 0,
      skipped_no_match: [] as string[],
      skipped_no_hcp: [] as string[],
      errors: [] as string[],
    };

    for (const p of profiles || []) {
      const requestedId = String(p.ghin_number).trim();
      try {
        const sr = await fetch(
          `https://api2.ghin.com/api/v1/golfers/search.json?golfer_id=${requestedId}&status=Active&per_page=10&page=1`,
          { headers: { Authorization: `Bearer ${ghinToken}` } },
        );
        if (!sr.ok) {
          summary.errors.push(`${p.display_name} (${requestedId}): API ${sr.status}`);
          await sleep(250);
          continue;
        }
        const sd = await sr.json();
        const golfers: any[] = sd?.golfers || [];
        const exact = golfers.find((g) => extractIds(g).includes(requestedId));

        if (!exact) {
          summary.skipped_no_match.push(`${p.display_name} (${requestedId})`);
          await sleep(250);
          continue;
        }

        const newHcp = parseFloat(exact.handicap_index);
        if (isNaN(newHcp)) {
          summary.skipped_no_hcp.push(`${p.display_name} (${requestedId})`);
          await sleep(250);
          continue;
        }

        if (Math.abs(newHcp - Number(p.handicap_index)) < 0.05) {
          // Still bump ghin_last_synced so we know it was checked
          await supabase
            .from("profiles")
            .update({ ghin_last_synced: new Date().toISOString() })
            .eq("id", p.id);
          summary.unchanged++;
        } else {
          await supabase
            .from("profiles")
            .update({
              handicap_index: newHcp,
              ghin_last_synced: new Date().toISOString(),
            })
            .eq("id", p.id);
          summary.updated++;
          console.log(`Updated ${p.display_name}: ${p.handicap_index} -> ${newHcp}`);
        }

        await sleep(250); // throttle GHIN calls
      } catch (e) {
        summary.errors.push(`${p.display_name} (${requestedId}): ${String(e)}`);
      }
    }

    console.log("Nightly GHIN refresh summary:", JSON.stringify(summary));
    return new Response(JSON.stringify(summary, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("nightly-ghin-refresh error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
