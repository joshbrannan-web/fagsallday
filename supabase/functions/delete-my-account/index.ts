import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const allowedOrigins = ["https://fagsallday.com", "https://www.fagsallday.com", "https://fagsallday.lovable.app"];

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const isAllowed = allowedOrigins.includes(origin) || origin.endsWith(".lovable.app") || origin.endsWith(".lovableproject.com") || origin === "" || origin.startsWith("capacitor://") || origin.startsWith("http://localhost");
  const corsHeaders = {
    "Access-Control-Allow-Origin": isAllowed && origin ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const uid = user.id;

    // Remove the user's own data; keep shared tournament history but unlink it.
    const { data: ownRounds } = await admin.from("rounds").select("id").eq("user_id", uid);
    const roundIds = (ownRounds || []).map((r: any) => r.id);
    if (roundIds.length) {
      await admin.from("tournament_groups").update({ round_id: null }).in("round_id", roundIds);
      await admin.from("round_participants").delete().in("round_id", roundIds);
      await admin.from("pending_round_links").delete().in("round_id", roundIds);
      await admin.from("rounds").delete().in("id", roundIds);
    }
    await admin.from("round_participants").delete().eq("user_id", uid);
    await admin.from("pending_round_links").delete().eq("owner_user_id", uid);
    await admin.from("pending_round_links").update({ claimed_by: null }).eq("claimed_by", uid);
    await admin.from("saved_courses").delete().eq("user_id", uid);
    await admin.from("saved_players").delete().eq("user_id", uid);
    await admin.from("saved_players").update({ linked_user_id: null }).eq("linked_user_id", uid);
    await admin.from("tournament_members").delete().eq("user_id", uid);
    await admin.from("tournament_admin_requests").delete().eq("user_id", uid);
    await admin.from("tournament_admin_requests").update({ reviewed_by: null }).eq("reviewed_by", uid);
    await admin.from("tournament_admins").delete().eq("user_id", uid);
    await admin.from("tournament_admins").update({ granted_by: null }).eq("granted_by", uid);
    await admin.from("tournament_players").update({ user_id: null }).eq("user_id", uid);
    await admin.from("tournament_registration_entries").update({ user_id: null }).eq("user_id", uid);

    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) {
      console.error("deleteUser failed", delErr);
      return json({ error: "Could not delete account. If you created tournaments, contact support." }, 500);
    }
    return json({ success: true });
  } catch (e: any) {
    console.error("delete-my-account error", e);
    return json({ error: "Something went wrong" }, 500);
  }
});
