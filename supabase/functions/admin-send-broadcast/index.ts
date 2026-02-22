import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const allowedOrigins = ["https://fagsallday.com", "https://www.fagsallday.com", "https://fagsallday.lovable.app"];

// Rate limiting: 5 broadcasts per hour per admin
const rateLimits = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxRequests = 5;
  const limit = rateLimits.get(userId);
  if (!limit || now > limit.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (limit.count >= maxRequests) return false;
  limit.count++;
  return true;
}

function buildEmailHtml(subject: string, message: string): string {
  // Convert newlines to <br> for the message body
  const formattedMessage = message.replace(/\n/g, "<br>");
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #16a34a; margin: 0; font-size: 28px;">⛳ F&Gs All Day</h1>
      </div>
      
      <h2 style="color: #1f2937; margin-bottom: 20px;">${subject}</h2>
      
      <div style="color: #4b5563; font-size: 16px; line-height: 1.6;">
        ${formattedMessage}
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://fagsallday.com" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
          Open F&Gs All Day
        </a>
      </div>
    </div>
    
    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
      © 2025 F&Gs All Day. Track scores, bets, and payouts automatically.
    </p>
  </div>
</body>
</html>`;
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const isAllowed = allowedOrigins.includes(origin) || origin.endsWith(".lovable.app") || origin.endsWith(".lovableproject.com");
  const corsOrigin = isAllowed ? origin : allowedOrigins[0];
  const corsHeaders = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Maximum 5 broadcasts per hour." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { subject, message } = await req.json();

    if (!subject?.trim() || !message?.trim()) {
      return new Response(
        JSON.stringify({ error: "Subject and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all user emails
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers();
    if (authError) throw authError;

    const emails = authUsers.users
      .map((u) => u.email)
      .filter((e): e is string => !!e);

    if (emails.length === 0) {
      return new Response(
        JSON.stringify({ error: "No users to send to" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Admin ${user.email} sending broadcast "${subject}" to ${emails.length} users`);

    const html = buildEmailHtml(subject.trim(), message.trim());

    // Send in batches of 50 using BCC to avoid exposing emails
    const batchSize = 50;
    let sentCount = 0;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      await resend.emails.send({
        from: "F&Gs All Day <noreply@fagsallday.com>",
        to: ["noreply@fagsallday.com"],
        bcc: batch,
        subject: subject.trim(),
        html,
      });
      
      sentCount += batch.length;
    }

    console.log(`Broadcast sent successfully to ${sentCount} users`);

    return new Response(
      JSON.stringify({ success: true, sentCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in admin-send-broadcast:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
