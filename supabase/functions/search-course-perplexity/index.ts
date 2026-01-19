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

// Helper function to normalize BlueGolf URLs to the detailedscorecard.htm format
function normalizeBlueGolfUrl(url: string): string {
  // If URL already contains detailedscorecard.htm, return as is
  if (url.includes('detailedscorecard.htm')) {
    return url;
  }
  
  // Extract the course slug from various URL formats
  // Format 1: /bluegolf/course/course/[slug]/...
  // Format 2: /bluegolf/coursehome/[slug]/...
  let slug = '';
  
  const courseMatch = url.match(/\/bluegolf\/course\/course\/([^\/]+)/);
  if (courseMatch) {
    slug = courseMatch[1];
  } else {
    const homepageMatch = url.match(/\/bluegolf\/coursehome\/([^\/]+)/);
    if (homepageMatch) {
      slug = homepageMatch[1];
    }
  }
  
  if (slug) {
    return `https://course.bluegolf.com/bluegolf/course/course/${slug}/detailedscorecard.htm`;
  }
  
  // If we can't parse it, return original
  return url;
}

async function searchCourses(apiKey: string, courseName: string, location?: string): Promise<Response> {
  const searchQuery = location 
    ? `${courseName} ${location}` 
    : courseName;

  console.log(`Searching BlueGolf for courses: ${searchQuery}`);

  const systemPrompt = `You are a golf course search assistant. Your task is to search course.bluegolf.com for golf courses matching the user's query.

IMPORTANT: BlueGolf URLs follow this format:
https://course.bluegolf.com/bluegolf/course/course/[course-slug]/detailedscorecard.htm

Examples of correct URLs:
- https://course.bluegolf.com/bluegolf/course/course/stocktongcc/detailedscorecard.htm
- https://course.bluegolf.com/bluegolf/course/course/pebblebeach/detailedscorecard.htm

Return a JSON object with this structure:
{
  "courses": [
    {
      "name": "Full Course Name",
      "location": "City, State",
      "url": "https://course.bluegolf.com/bluegolf/course/course/[slug]/detailedscorecard.htm"
    }
  ]
}

Guidelines:
- Search ONLY on course.bluegolf.com
- Return URLs in the detailedscorecard.htm format
- The course slug is typically the course name in lowercase without spaces (e.g., "stocktongcc", "pebblebeach")
- Return all matching courses (up to 10)
- If no courses are found, return an empty courses array`;

  const userPrompt = `Find golf courses on course.bluegolf.com matching: "${searchQuery}"

Return ONLY the JSON object with the list of matching courses.
Use the detailedscorecard.htm URL format: https://course.bluegolf.com/bluegolf/course/course/[slug]/detailedscorecard.htm`;

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
    let courses: CourseListItem[] = parsed.courses || [];
    
    // Normalize all URLs to the detailedscorecard.htm format
    courses = courses.map(course => ({
      ...course,
      url: normalizeBlueGolfUrl(course.url)
    }));
    
    console.log('Normalized course URLs:', courses.map(c => c.url));

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

  // Step 1: Use Firecrawl to scrape the BlueGolf page
  const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!FIRECRAWL_API_KEY) {
    console.error('FIRECRAWL_API_KEY not configured');
    return new Response(
      JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not configured');
    return new Response(
      JSON.stringify({ success: false, error: 'Lovable API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Ensure URL is properly formatted and normalized to detailedscorecard.htm
  let formattedUrl = courseUrl.trim();
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = `https://${formattedUrl}`;
  }
  
  // Normalize URL to use the detailedscorecard.htm format
  formattedUrl = normalizeBlueGolfUrl(formattedUrl);

  console.log('Scraping BlueGolf page with Firecrawl:', formattedUrl);

  const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: formattedUrl,
      formats: ['markdown'],
      onlyMainContent: false, // We need the full page including scorecard tables
      waitFor: 2000, // Wait for dynamic content to load
    }),
  });

  if (!firecrawlResponse.ok) {
    const errorText = await firecrawlResponse.text();
    console.error('Firecrawl API error:', firecrawlResponse.status, errorText);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Failed to scrape BlueGolf page: ${firecrawlResponse.status}`,
        details: errorText
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const firecrawlData = await firecrawlResponse.json();
  const scrapedMarkdown = firecrawlData.data?.markdown || firecrawlData.markdown;
  
  if (!scrapedMarkdown) {
    console.error('No markdown content from Firecrawl:', JSON.stringify(firecrawlData, null, 2));
    return new Response(
      JSON.stringify({ success: false, error: 'No content scraped from BlueGolf page' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log('Scraped content length:', scrapedMarkdown.length);
  console.log('Scraped content preview:', scrapedMarkdown.substring(0, 500));

  // Step 2: Use Lovable AI to parse the scraped content
  const systemPrompt = `You are a golf course data parser. Your task is to extract scorecard data from BlueGolf page content.

The content contains a scorecard table with this structure:
- Rows for: Tee names (Black, Blue, White, etc.), yardage, par, and handicap (Hcp)
- Columns for holes 1-18 plus Out (front 9), In (back 9), and Tot (total)

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
- Use the "Blue" or "Back" tees for yardage (second row typically)
- The "Par" row contains par values for each hole
- The "Hcp" or "Handicap" row contains stroke index values
- IMPORTANT: Parse the ACTUAL numbers from the table, do not make up values
- If a value is unclear, use reasonable defaults but flag it
- Ensure all 18 holes are extracted in order`;

  const userPrompt = `Parse the golf course scorecard from this BlueGolf page content for "${courseName}":

${scrapedMarkdown}

Extract all 18 holes with their par, yardage (from Blue/Back tees), and handicap index.
Return ONLY the JSON object with the parsed data.`;

  console.log('Calling Lovable AI to parse scorecard...');

  const parseResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
    }),
  });

  if (!parseResponse.ok) {
    const errorText = await parseResponse.text();
    console.error('Lovable AI error:', parseResponse.status, errorText);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Failed to parse scorecard: ${parseResponse.status}`,
        details: errorText
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const parseData = await parseResponse.json();
  const content = parseData.choices?.[0]?.message?.content;

  if (!content) {
    console.error('No content from Lovable AI:', JSON.stringify(parseData, null, 2));
    return new Response(
      JSON.stringify({ success: false, error: 'No parsed content from AI' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log('Lovable AI response:', content.substring(0, 500));

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

    // Recalculate totals from parsed data
    courseData.totalPar = courseData.holes.reduce((sum, h) => sum + h.par, 0);
    courseData.totalYardage = courseData.holes.reduce((sum, h) => sum + h.yardage, 0);

    console.log(`Parsed course: ${courseData.name}, Par ${courseData.totalPar}, ${courseData.totalYardage} yards`);

    return new Response(
      JSON.stringify({
        success: true,
        course: courseData,
        sourceUrl: formattedUrl,
        source: 'bluegolf-scraped'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (parseError) {
    console.error('Failed to parse course data:', parseError);
    console.error('Raw AI content:', content);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to parse course data from AI response',
        rawContent: content
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
