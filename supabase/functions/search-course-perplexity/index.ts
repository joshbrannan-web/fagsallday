import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HoleData {
  number: number;
  par: number;
  yardage: number;
  handicapIndex: number;
}

interface CourseData {
  name: string;
  location: string;
  holes: HoleData[];
  totalPar: number;
  totalYardage: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { courseName, location } = await req.json();
    
    if (!courseName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Course name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Perplexity API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchQuery = location 
      ? `${courseName} ${location} golf course scorecard` 
      : `${courseName} golf course scorecard`;

    console.log(`Searching for course: ${searchQuery}`);

    const systemPrompt = `You are a golf course data expert. When asked about a golf course scorecard, provide accurate hole-by-hole data including par, yardage, and handicap index (stroke index) for all 18 holes.

IMPORTANT: You must respond with valid JSON matching this exact structure:
{
  "name": "Full Course Name",
  "location": "City, State/Country",
  "holes": [
    { "number": 1, "par": 4, "yardage": 380, "handicapIndex": 8 },
    { "number": 2, "par": 5, "yardage": 502, "handicapIndex": 6 },
    ... (all 18 holes)
  ],
  "totalPar": 72,
  "totalYardage": 6500
}

Guidelines:
- Use the most commonly played tee (usually "Blue" or "Championship" tees for men)
- handicapIndex is the stroke index/handicap ranking (1-18, where 1 is hardest)
- If you cannot find exact data, use realistic estimates based on similar courses
- Always provide all 18 holes
- Ensure totalPar and totalYardage match the sum of individual holes`;

    const userPrompt = `Find the complete scorecard data for "${courseName}"${location ? ` located in ${location}` : ''}. 

I need:
1. Official course name
2. Location (city, state)
3. All 18 holes with:
   - Par for each hole
   - Yardage for each hole (from a standard men's tee)
   - Handicap/stroke index for each hole (1-18 difficulty ranking)
4. Total par
5. Total yardage

Return ONLY the JSON object, no additional text.`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Perplexity API error: ${response.status}`,
          details: errorText
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Perplexity response:', JSON.stringify(data, null, 2));

    const content = data.choices?.[0]?.message?.content;
    const citations = data.citations || [];

    if (!content) {
      return new Response(
        JSON.stringify({ success: false, error: 'No content in Perplexity response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON from the response
    let courseData: CourseData;
    try {
      // Try to extract JSON from the response (might be wrapped in markdown code blocks)
      let jsonStr = content;
      
      // Remove markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      // Try to find JSON object in the response
      const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonStr = objectMatch[0];
      }

      courseData = JSON.parse(jsonStr);
      
      // Validate the parsed data
      if (!courseData.name || !courseData.holes || !Array.isArray(courseData.holes)) {
        throw new Error('Invalid course data structure');
      }

      // Ensure all 18 holes are present
      if (courseData.holes.length !== 18) {
        console.warn(`Expected 18 holes, got ${courseData.holes.length}`);
      }

      // Normalize hole data
      courseData.holes = courseData.holes.map((hole, index) => ({
        number: hole.number || index + 1,
        par: hole.par || 4,
        yardage: hole.yardage || 350,
        handicapIndex: hole.handicapIndex || (index + 1)
      }));

      // Recalculate totals
      courseData.totalPar = courseData.holes.reduce((sum, h) => sum + h.par, 0);
      courseData.totalYardage = courseData.holes.reduce((sum, h) => sum + h.yardage, 0);

    } catch (parseError) {
      console.error('Failed to parse course data:', parseError);
      console.error('Raw content:', content);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to parse course data from response',
          rawContent: content,
          citations
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        course: courseData,
        citations,
        source: 'perplexity'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-course-perplexity:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
