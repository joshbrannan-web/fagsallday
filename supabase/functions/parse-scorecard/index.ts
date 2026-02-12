import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = ["https://fagsallday.com", "https://www.fagsallday.com", "https://fagsallday.lovable.app"];

interface TeeBox {
  name: string;
  color: string;
  rating?: number;
  slope?: number;
  holes: {
    number: number;
    yardage: number;
    par: number;
    handicapIndex: number;
  }[];
  totalYardage: number;
  totalPar: number;
}

interface ParsedScorecard {
  courseName: string;
  location: string;
  teeBoxes: TeeBox[];
}

serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - please log in to use this feature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired session - please log in again' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log('Authenticated user:', userId);

    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'Image data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (imageBase64.length > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ success: false, error: 'Image is too large. Please use an image under 7.5MB.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing scorecard image with AI for user:', userId);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a golf scorecard data extraction expert. Analyze the scorecard image and extract all course information.

Extract the following data in JSON format:
1. Course name
2. Location (city, state if visible)
3. All tee boxes shown (e.g., Black, Blue, White, Gold, Red)
4. For each tee box, extract:
   - Tee box name and color
   - Course rating and slope (if shown)
   - Each hole's yardage, par, and handicap/stroke index

Return ONLY valid JSON in this exact format:
{
  "courseName": "string",
  "location": "string or empty",
  "teeBoxes": [
    {
      "name": "Black Tees",
      "color": "black",
      "rating": 73.5,
      "slope": 135,
      "holes": [
        {"number": 1, "yardage": 405, "par": 4, "handicapIndex": 7},
        {"number": 2, "yardage": 385, "par": 4, "handicapIndex": 3}
      ],
      "totalYardage": 6800,
      "totalPar": 72
    }
  ]
}

Important notes:
- Extract ALL tee boxes visible on the scorecard
- Handicap index (HCP/HDCP/SI) is the stroke index 1-18, NOT the same as par
- If you can't read a value clearly, use reasonable defaults (par 4, typical yardage for hole position)
- Ensure hole numbers go 1-18 for full course or 1-9 for 9-hole courses
- Common tee colors: Black, Blue, White, Gold/Yellow, Red
- If only one set of yardages is visible, create one tee box with color "white"`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this golf scorecard image and extract all the course data, including all tee boxes with their yardages, pars, and handicap indexes for each hole.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 8192,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to process image with AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('AI response received, parsing JSON...');

    let jsonString = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1].trim();
    } else {
      const openFenceMatch = content.match(/```(?:json)?\s*([\s\S]*)/);
      if (openFenceMatch) {
        jsonString = openFenceMatch[1].trim();
      }
    }
    
    if (jsonString && !jsonString.trimEnd().endsWith('}')) {
      const lastBrace = jsonString.lastIndexOf('}');
      if (lastBrace > 0) {
        const truncated = jsonString.slice(0, lastBrace + 1);
        let openBraces = 0;
        let openBrackets = 0;
        for (const ch of truncated) {
          if (ch === '{') openBraces++;
          if (ch === '}') openBraces--;
          if (ch === '[') openBrackets++;
          if (ch === ']') openBrackets--;
        }
        let repaired = truncated;
        while (openBrackets > 0) { repaired += ']'; openBrackets--; }
        while (openBraces > 0) { repaired += '}'; openBraces--; }
        jsonString = repaired;
      }
    }

    let parsedData: ParsedScorecard;
    try {
      parsedData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to parse scorecard data. Please try again or enter course details manually.',
          rawResponse: content.slice(0, 500)
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!parsedData.teeBoxes || parsedData.teeBoxes.length === 0) {
      parsedData.teeBoxes = [{
        name: 'White Tees',
        color: 'white',
        holes: Array.from({ length: 18 }, (_, i) => ({
          number: i + 1,
          yardage: 350 + (i % 5) * 50,
          par: [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4][i],
          handicapIndex: i + 1
        })),
        totalYardage: 6200,
        totalPar: 72
      }];
    }

    parsedData.teeBoxes = parsedData.teeBoxes.map(teeBox => {
      const holes = teeBox.holes || [];
      const normalizedHoles = [];
      const numHoles = holes.length > 9 ? 18 : 9;
      
      for (let i = 1; i <= numHoles; i++) {
        const existingHole = holes.find(h => h.number === i);
        if (existingHole) {
          normalizedHoles.push({
            number: i,
            yardage: existingHole.yardage || 350,
            par: existingHole.par || 4,
            handicapIndex: existingHole.handicapIndex || i
          });
        } else {
          normalizedHoles.push({
            number: i,
            yardage: 350,
            par: 4,
            handicapIndex: i
          });
        }
      }

      return {
        name: teeBox.name || 'White Tees',
        color: teeBox.color || 'white',
        rating: teeBox.rating,
        slope: teeBox.slope,
        holes: normalizedHoles,
        totalYardage: normalizedHoles.reduce((sum, h) => sum + h.yardage, 0),
        totalPar: normalizedHoles.reduce((sum, h) => sum + h.par, 0)
      };
    });

    console.log('Successfully parsed scorecard:', parsedData.courseName);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: parsedData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in parse-scorecard function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to parse scorecard';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
