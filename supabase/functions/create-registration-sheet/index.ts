import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getAccessToken(serviceAccount: any): Promise<string> {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const claimSet = btoa(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );

  const pemContent = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureInput = new TextEncoder().encode(`${header}.${claimSet}`);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, signatureInput);
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)));

  const jwt = `${header}.${claimSet}.${sig}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Failed to get access token");
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { title, admin_email } = await req.json();
    if (!title || typeof title !== "string" || title.length > 255) {
      return new Response(JSON.stringify({ error: "Invalid title" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKey) {
      return new Response(
        JSON.stringify({ error: "Google service account not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    let serviceAccount: any;
    try {
      const trimmed = serviceAccountKey.trim();
      serviceAccount = JSON.parse(
        trimmed.startsWith("{") ? trimmed : JSON.parse(trimmed)
      );
    } catch (parseErr) {
      console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:", parseErr);
      return new Response(
        JSON.stringify({ error: "Invalid service account key format" }),
        { status: 500, headers: corsHeaders }
      );
    }
    const accessToken = await getAccessToken(serviceAccount);

    // Create spreadsheet
    const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: { title: `${title} - Registrations` },
        sheets: [
          {
            properties: { title: "Registrations" },
            data: [
              {
                startRow: 0,
                startColumn: 0,
                rowData: [
                  {
                    values: [
                      "Full Name",
                      "Email",
                      "Phone",
                      "Handicap Index",
                      "GHIN #",
                      "Payment Amount",
                      "Payment Confirmed",
                      "Registered At",
                    ].map((v) => ({
                      userEnteredValue: { stringValue: v },
                      userEnteredFormat: { textFormat: { bold: true } },
                    })),
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    const sheetData = await createRes.json();
    if (!sheetData.spreadsheetId) {
      console.error("Sheet creation failed:", JSON.stringify(sheetData));
      return new Response(JSON.stringify({ error: "Failed to create sheet" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Share with admin email if provided
    if (admin_email && typeof admin_email === "string") {
      const permRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${sheetData.spreadsheetId}/permissions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: "writer",
            type: "user",
            emailAddress: admin_email,
          }),
        }
      );
      const permText = await permRes.text();
      if (!permRes.ok) {
        console.warn("Failed to share sheet:", permText);
      }
    }

    // Make sheet accessible to anyone with the link
    const linkPermRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${sheetData.spreadsheetId}/permissions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "writer",
          type: "anyone",
        }),
      }
    );
    if (!linkPermRes.ok) {
      console.warn("Failed to set link sharing:", await linkPermRes.text());
    }

    return new Response(
      JSON.stringify({
        sheet_id: sheetData.spreadsheetId,
        sheet_url: sheetData.spreadsheetUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
