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

interface CourseListItem {
  name: string;
  location: string;
  url: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { courseName, location, mode = 'search', selectedCourseUrl } = await req.json();
    
    if (!courseName && mode === 'search') {
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

    // Mode 1: Search for courses on BlueGolf
    if (mode === 'search') {
      return await searchCourses(PERPLEXITY_API_KEY, courseName, location);
    }
    
    // Mode 2: Fetch detailed scorecard for a specific course
    if (mode === 'fetch' && selectedCourseUrl) {
      return await fetchCourseDetails(PERPLEXITY_API_KEY, selectedCourseUrl, courseName);
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid mode or missing parameters' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

async function searchCourses(apiKey: string, courseName: string, location?: string): Promise<Response> {
  const searchQuery = location 
    ? `${courseName} ${location}` 
    : courseName;

  console.log(`Searching BlueGolf for courses: ${searchQuery}`);

  const systemPrompt = `You are a golf course search assistant. Your task is to search course.bluegolf.com for golf courses matching the user's query.

Return a JSON object with this structure:
{
  "courses": [
    {
      "name": "Full Course Name",
      "location": "City, State",
      "url": "https://course.bluegolf.com/..."
    }
  ]
}

Guidelines:
- Search ONLY on course.bluegolf.com
- Return all matching courses (up to 10)
- Include the exact BlueGolf URL for each course
- If only one course matches exactly, still return it in the courses array
- If no courses are found, return an empty courses array`;

  const userPrompt = `Find golf courses on course.bluegolf.com matching: "${searchQuery}"

Return ONLY the JSON object with the list of matching courses, including their BlueGolf URLs.`;

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      search_domain_filter: ['course.bluegolf.com'],
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
  console.log('Perplexity search response:', JSON.stringify(data, null, 2));

  const content = data.choices?.[0]?.message?.content;
  const citations = data.citations || [];

  if (!content) {
    return new Response(
      JSON.stringify({ success: false, error: 'No content in Perplexity response' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const parsed = parseJsonFromContent(content);
    const courses: CourseListItem[] = parsed.courses || [];

    // If only one course found, automatically fetch its details
    if (courses.length === 1 && courses[0].url) {
      console.log('Single course found, fetching details...');
      return await fetchCourseDetails(apiKey, courses[0].url, courses[0].name);
    }

    return new Response(
      JSON.stringify({
        success: true,
        courses,
        citations,
        source: 'bluegolf'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (parseError) {
    console.error('Failed to parse course list:', parseError);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to parse course list from response',
        rawContent: content,
        citations
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function fetchCourseDetails(apiKey: string, courseUrl: string, courseName: string): Promise<Response> {
  console.log(`Fetching scorecard details from: ${courseUrl}`);

  const systemPrompt = `You are a golf course data expert. Your task is to find the complete scorecard data for a specific golf course from course.bluegolf.com.

Return a JSON object with this EXACT structure:
{
  "name": "Full Course Name",
  "location": "City, State",
  "holes": [
    { "number": 1, "par": 4, "yardage": 380, "handicapIndex": 8 },
    { "number": 2, "par": 5, "yardage": 502, "handicapIndex": 6 },
    ... (all 18 holes)
  ],
  "totalPar": 72,
  "totalYardage": 6500
}

Guidelines:
- Get data from the course.bluegolf.com scorecard
- Use the "Blue" or "Back" tees for yardage (standard men's tees)
- handicapIndex is the stroke index/handicap ranking (1-18)
- IMPORTANT: Verify par values match official scorecard
- Ensure all 18 holes are included
- totalPar and totalYardage should match the sum of individual holes`;

  const userPrompt = `Get the complete scorecard data for "${courseName}" from this BlueGolf page: ${courseUrl}

I need:
1. Official course name
2. Location (city, state)
3. All 18 holes with par, yardage (Blue/Back tees), and handicap/stroke index
4. Total par and total yardage

Return ONLY the JSON object, no additional text.`;

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      search_domain_filter: ['course.bluegolf.com'],
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
  console.log('Perplexity fetch response:', JSON.stringify(data, null, 2));

  const content = data.choices?.[0]?.message?.content;
  const citations = data.citations || [];

  if (!content) {
    return new Response(
      JSON.stringify({ success: false, error: 'No content in Perplexity response' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const courseData: CourseData = parseJsonFromContent(content);
    
    if (!courseData.name || !courseData.holes || !Array.isArray(courseData.holes)) {
      throw new Error('Invalid course data structure');
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

    return new Response(
      JSON.stringify({
        success: true,
        course: courseData,
        citations,
        source: 'bluegolf'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (parseError) {
    console.error('Failed to parse course data:', parseError);
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
}

function parseJsonFromContent(content: string): any {
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

  return JSON.parse(jsonStr);
}
