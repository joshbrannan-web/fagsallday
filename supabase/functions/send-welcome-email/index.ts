import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const allowedOrigins = ["https://fagsallday.com", "https://www.fagsallday.com", "https://fagsallday.lovable.app"];

// Simple in-memory rate limiting for welcome email abuse prevention
const welcomeRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkWelcomeRateLimit(email: string): boolean {
  const identifier = email.toLowerCase().trim();
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const maxRequests = 2;
  
  const limit = welcomeRateLimits.get(identifier);
  
  if (!limit || now > limit.resetAt) {
    welcomeRateLimits.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (limit.count >= maxRequests) {
    return false;
  }
  
  limit.count++;
  return true;
}

interface WelcomeEmailRequest {
  email: string;
  displayName: string;
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin") || "";
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  const corsHeaders = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { email, displayName }: WelcomeEmailRequest = await req.json();

    if (email.toLowerCase() !== user.email?.toLowerCase()) {
      console.log("Attempted to send welcome email to non-matching email:", email, "vs", user.email);
      return new Response(
        JSON.stringify({ error: "Can only send welcome email to your own email address" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!checkWelcomeRateLimit(email)) {
      console.log("Rate limit exceeded for welcome email:", email);
      return new Response(
        JSON.stringify({ id: "rate-limited", message: "Email rate limited" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Sending welcome email to authenticated user:", email);

    const emailResponse = await resend.emails.send({
      from: "F&Gs All Day <noreply@fagsallday.com>",
      to: [email],
      subject: "Welcome to F&Gs All Day!",
      html: `
        <!DOCTYPE html>
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
              
              <h2 style="color: #1f2937; margin-bottom: 20px;">Welcome, ${displayName}!</h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                Your account has been created successfully. You can now track scores, bets, and payouts automatically!
              </p>
              
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <h3 style="color: #166534; margin: 0 0 12px 0; font-size: 16px;">Your Account</h3>
                <p style="color: #4b5563; margin: 4px 0;"><strong>Email:</strong> ${email}</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://fagsallday.com" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  Start Playing
                </a>
              </div>
              
              <p style="color: #9ca3af; font-size: 14px; text-align: center; margin-top: 30px;">
                If you didn't create this account, please ignore this email.
              </p>
            </div>
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
              © 2025 F&Gs All Day. Track scores, bets, and payouts automatically.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
