import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Simple in-memory rate limiting (per edge function instance)
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(identifier: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const limit = rateLimits.get(identifier);
  
  if (!limit || now > limit.resetAt) {
    rateLimits.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (limit.count >= maxRequests) {
    return false;
  }
  
  limit.count++;
  return true;
}

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

// ==================== GolfCourseAPI.com Integration ====================

async function searchGolfCourseAPI(query: string, apiKey: string): Promise<CourseListItem[]> {
  console.log(`[GolfCourseAPI] Searching for: ${query}`);
  const url = `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(query)}`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Key ${apiKey}` },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[GolfCourseAPI] Search failed: ${response.status}`, text);
    return [];
  }

  const data = await response.json();
  const courses = data.courses || [];
  console.log(`[GolfCourseAPI] Found ${courses.length} courses`);

  return courses.map((c: any) => ({
    name: c.club_name || c.course_name || 'Unknown',
    location: [c.location?.city, c.location?.state].filter(Boolean).join(', ') || 'Location not specified',
    url: `golfcourseapi:${c.id}`, // Prefix to distinguish from BlueGolf URLs
  }));
}

async function fetchFromGolfCourseAPI(courseId: string, apiKey: string): Promise<CourseData | null> {
  console.log(`[GolfCourseAPI] Fetching course details for ID: ${courseId}`);
  const url = `https://api.golfcourseapi.com/v1/courses/${courseId}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Key ${apiKey}` },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[GolfCourseAPI] Fetch failed: ${response.status}`, text);
    return null;
  }

  const data = await response.json();
  const course = data.course || data;
  
  // API uses course.tees.male[] and course.tees.female[] (not course.teeboxes[])
  const maleTees = course.tees?.male || [];
  const femaleTees = course.tees?.female || [];
  const allTees = [...maleTees, ...femaleTees];
  
  console.log(`[GolfCourseAPI] Course: ${course.course_name}, male tees: ${maleTees.length}, female tees: ${femaleTees.length}`);

  // Find the best tee box: prefer "Blue" male, then first male tee, then any
  let selectedTee = maleTees.find((t: any) => t.tee_name?.toLowerCase() === 'blue');
  if (!selectedTee && maleTees.length > 0) {
    selectedTee = maleTees[0];
  }
  if (!selectedTee && allTees.length > 0) {
    selectedTee = allTees[0];
  }

  if (!selectedTee || !selectedTee.holes || selectedTee.holes.length === 0) {
    console.error('[GolfCourseAPI] No usable tee box found');
    return null;
  }

  console.log(`[GolfCourseAPI] Using tee: ${selectedTee.tee_name} (${selectedTee.total_yards} yards)`);

  // Holes don't have hole_number, they're in order by index
  const holes: HoleData[] = selectedTee.holes.map((h: any, i: number) => ({
      number: i + 1,
      par: h.par,
      yardage: h.yardage,
      handicapIndex: h.handicap,
    }));

  const location = [course.location?.city, course.location?.state].filter(Boolean).join(', ') || 'Location not specified';

  return {
    name: course.course_name || course.club_name || 'Unknown Course',
    location,
    holes,
    totalPar: holes.reduce((sum, h) => sum + h.par, 0),
    totalYardage: holes.reduce((sum, h) => sum + h.yardage, 0),
  };
}

// ==================== Main Handler ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log('Authenticated user:', userId);

    if (!checkRateLimit(`search-course:${userId}`, 10, 60000)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Rate limit exceeded. Please wait before trying again.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { courseName, location, mode = 'search', selectedCourseUrl } = await req.json();
    
    if (!courseName && mode === 'search') {
      return new Response(
        JSON.stringify({ success: false, error: 'Course name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GOLF_COURSE_API_KEY = Deno.env.get('GOLF_COURSE_API_KEY');

    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lovable API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'search') {
      // Try GolfCourseAPI first, fall back to BlueGolf/Firecrawl
      if (GOLF_COURSE_API_KEY) {
        try {
          const apiResults = await searchGolfCourseAPI(courseName, GOLF_COURSE_API_KEY);
          if (apiResults.length > 0) {
            // If single result, fetch details directly
            if (apiResults.length === 1) {
              const courseId = apiResults[0].url.replace('golfcourseapi:', '');
              const details = await fetchFromGolfCourseAPI(courseId, GOLF_COURSE_API_KEY);
              if (details) {
                return new Response(
                  JSON.stringify({ success: true, course: details, source: 'golfcourseapi' }),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }
            return new Response(
              JSON.stringify({ success: true, courses: apiResults, source: 'golfcourseapi' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          console.log('[GolfCourseAPI] No results, falling back to BlueGolf');
        } catch (e) {
          console.error('[GolfCourseAPI] Search error, falling back:', e);
        }
      }
      return await searchCourses(FIRECRAWL_API_KEY, LOVABLE_API_KEY, courseName, location, corsHeaders);
    }
    
    if (mode === 'fetch' && selectedCourseUrl) {
      // Route to GolfCourseAPI if it's a golfcourseapi: prefixed ID
      if (selectedCourseUrl.startsWith('golfcourseapi:') && GOLF_COURSE_API_KEY) {
        const courseId = selectedCourseUrl.replace('golfcourseapi:', '');
        const details = await fetchFromGolfCourseAPI(courseId, GOLF_COURSE_API_KEY);
        if (details) {
          return new Response(
            JSON.stringify({ success: true, course: details, source: 'golfcourseapi' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch course details from GolfCourseAPI' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await fetchCourseDetails(FIRECRAWL_API_KEY, LOVABLE_API_KEY, selectedCourseUrl, courseName, corsHeaders);
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid mode or missing parameters' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-course:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ==================== BlueGolf Helpers (kept as fallback) ====================

// Helper function to normalize BlueGolf URLs to the detailedscorecard.htm format
function normalizeBlueGolfUrl(url: string): string {
  if (url.includes('detailedscorecard.htm')) {
    return url;
  }
  
  let slug = '';
  
  const courseMatch = url.match(/\/bluegolf\/course\/course\/([^\/]+)/);
  if (courseMatch) {
    slug = courseMatch[1];
  } else {
    const homepageMatch = url.match(/\/bluegolf\/coursehome\/([^\/]+)/);
    if (homepageMatch) {
      slug = homepageMatch[1];
    } else {
      const simpleMatch = url.match(/course\.bluegolf\.com\/bluegolf\/([^\/]+)/);
      if (simpleMatch && !simpleMatch[1].includes('course')) {
        slug = simpleMatch[1];
      }
    }
  }
  
  if (slug) {
    return `https://course.bluegolf.com/bluegolf/course/course/${slug}/detailedscorecard.htm`;
  }
  
  return url;
}

// Known false positives from BlueGolf table headers
const LOCATION_BLOCKLIST = [
  'In, Tot', 'Out, In', 'Show All', 'In, To', 'Par, Hcp',
  'Blue, White', 'Black, Blue', 'Red, Gold',
];

// Extract location from search result description or title
function extractLocationFromResult(result: { title?: string; description?: string; url?: string }): string {
  const text = `${result.title || ''} ${result.description || ''}`;
  
  const patterns = [
    /in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})/,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})/,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z][a-z]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const candidate = match[1];
      if (LOCATION_BLOCKLIST.some(blocked => candidate.includes(blocked))) {
        continue;
      }
      if (candidate.length < 5) {
        continue;
      }
      return candidate;
    }
  }
  
  return 'Location not specified';
}

// Extract course name from search result
function extractCourseName(result: { title?: string; url?: string }): string {
  if (result.title) {
    const cleanTitle = result.title
      .replace(/\s*[-|]\s*BlueGolf.*$/i, '')
      .replace(/\s*[-|]\s*Scorecard.*$/i, '')
      .replace(/\s*Detailed\s*Scorecard.*$/i, '')
      .replace(/\s*[-|]+\s*$/, '')
      .trim();
    
    if (cleanTitle) {
      return cleanTitle;
    }
  }
  
  if (result.url) {
    const urlMatch = result.url.match(/\/course\/([^\/]+)/);
    if (urlMatch) {
      return urlMatch[1]
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
  }
  
  return 'Unknown Course';
}

async function searchCourses(firecrawlKey: string, lovableKey: string, courseName: string, location: string | undefined, corsHeaders: Record<string, string>): Promise<Response> {
  const searchQuery = location 
    ? `site:course.bluegolf.com ${courseName} ${location} scorecard`
    : `site:course.bluegolf.com ${courseName} scorecard`;

  console.log(`Searching BlueGolf for courses with Firecrawl: ${searchQuery}`);

    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 10,
      }),
    });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Firecrawl search error:', response.status, errorText);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Firecrawl search error: ${response.status}`,
        details: errorText
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const data = await response.json();
  console.log('Firecrawl search response:', JSON.stringify(data, null, 2));

  const searchResults = data.data || [];

  if (searchResults.length === 0) {
    return new Response(
      JSON.stringify({ 
        success: true, 
        courses: [],
        message: 'No courses found on BlueGolf matching your search'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Filter to valid BlueGolf URLs and deduplicate
  const filteredResults = searchResults
    .filter((result: any) => {
      const url = result.url || '';
      return url.includes('course.bluegolf.com') && 
             (url.includes('/course/') || url.includes('/bluegolf/'));
    })
    .filter((result: any, index: number, self: any[]) => {
      const normalizedUrl = normalizeBlueGolfUrl(result.url);
      return index === self.findIndex((r: any) => normalizeBlueGolfUrl(r.url) === normalizedUrl);
    });

  // Use AI to look up locations based on course names and titles
  let aiExtracted: Record<string, { name: string; location: string }> = {};
  if (filteredResults.length > 0) {
    try {
      aiExtracted = await extractNamesAndLocationsWithAI(lovableKey, filteredResults);
      console.log('AI extracted data:', JSON.stringify(aiExtracted, null, 2));
    } catch (e) {
      console.error('AI batch extraction failed, falling back to regex:', e);
    }
  }

  const courses: CourseListItem[] = filteredResults.map((result: any) => {
    const normalizedUrl = normalizeBlueGolfUrl(result.url);
    const ai = aiExtracted[result.url] || aiExtracted[normalizedUrl];
    return {
      name: ai?.name || extractCourseName(result),
      location: ai?.location || extractLocationFromResult(result),
      url: normalizedUrl,
    };
  });

  console.log('Parsed courses:', courses);

  if (courses.length === 1 && courses[0].url) {
    console.log('Single course found, fetching details...');
    return await fetchCourseDetails(firecrawlKey, lovableKey, courses[0].url, courses[0].name, corsHeaders, courses[0].location);
  }

  return new Response(
    JSON.stringify({
      success: true,
      courses,
      source: 'bluegolf-firecrawl'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function fetchCourseDetails(firecrawlKey: string, lovableKey: string, courseUrl: string, courseName: string, corsHeaders: Record<string, string>, searchLocation?: string): Promise<Response> {
  console.log(`Fetching scorecard details from: ${courseUrl}`);

  let formattedUrl = courseUrl.trim();
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = `https://${formattedUrl}`;
  }
  
  formattedUrl = normalizeBlueGolfUrl(formattedUrl);

  console.log('Scraping BlueGolf page with Firecrawl:', formattedUrl);

  const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firecrawlKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: formattedUrl,
      formats: ['markdown'],
      onlyMainContent: false,
      waitFor: 2000,
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

  // Detect CAPTCHA or insufficient content
  const isCaptcha = (md: string) =>
    md.length < 1000 ||
    md.toLowerCase().includes('confirm you are human') ||
    md.toLowerCase().includes('solve a puzzle') ||
    md.toLowerCase().includes('security check') ||
    md.toLowerCase().includes('captcha');

  let finalMarkdown = scrapedMarkdown;

  if (isCaptcha(scrapedMarkdown)) {
    console.log('CAPTCHA detected on first attempt, retrying after delay...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const retryResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown'],
        onlyMainContent: false,
        waitFor: 5000,
      }),
    });

    if (retryResponse.ok) {
      const retryData = await retryResponse.json();
      const retryMarkdown = retryData.data?.markdown || retryData.markdown || '';
      console.log('Retry scraped content length:', retryMarkdown.length);

      if (isCaptcha(retryMarkdown)) {
        console.error('CAPTCHA detected on retry as well');
        // Fallback: check verified courses library
        const fallback = await tryVerifiedCourseFallback(courseName);
        if (fallback) {
          console.log('Found verified course fallback for:', courseName);
          return new Response(
            JSON.stringify({
              success: true,
              course: fallback,
              sourceUrl: formattedUrl,
              source: 'verified-library-fallback'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({
            success: false,
            error: 'BlueGolf blocked the request with a security check. Please try again in a moment or enter course details manually.',
            sourceUrl: formattedUrl
          }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      finalMarkdown = retryMarkdown;
    } else {
      console.error('Retry scrape failed:', retryResponse.status);
      const fallback = await tryVerifiedCourseFallback(courseName);
      if (fallback) {
        console.log('Found verified course fallback for:', courseName);
        return new Response(
          JSON.stringify({
            success: true,
            course: fallback,
            sourceUrl: formattedUrl,
            source: 'verified-library-fallback'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: 'BlueGolf blocked the request. Please try again in a moment or enter course details manually.',
          sourceUrl: formattedUrl
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  if (finalMarkdown.includes('404') && finalMarkdown.includes('Page Not Found')) {
    console.error('BlueGolf page returned 404');
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Course page not found on BlueGolf. The course may not be listed or the URL may be incorrect.',
        sourceUrl: formattedUrl
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const locationHint = searchLocation && searchLocation !== 'Location not specified' 
    ? `\nNote: From search results, this course may be located in "${searchLocation}". Use this as a fallback if you cannot find the location on the page.`
    : '';

  const systemPrompt = `You are a golf course data parser. Your task is to extract scorecard data from BlueGolf page content.

The content contains a scorecard table with this structure:
- Rows for: Tee names (Black, Blue, White, etc.), yardage, par, and handicap (Hcp)
- Columns for holes 1-18 plus Out (front 9), In (back 9), and Tot (total)

Return a JSON object with this EXACT structure:
{
  "name": "Full Course Name",
  "location": "City, State (e.g. Pebble Beach, CA)",
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
- Ensure all 18 holes are extracted in order
- IMPORTANT: For the "location" field, look for the course's city and state on the page (often shown in the header, breadcrumb, or address area). The location MUST be a real city and state — never leave it empty or as "Location not specified". If the page shows an address, extract the city and state from it.${locationHint}

CRITICAL: If the page content does not contain an actual scorecard table with numeric hole data (par, yardage, handicap values), you MUST return { "error": "no_scorecard_data" } instead of guessing. NEVER invent, estimate, or use memorized values. Only extract data that is explicitly present in the content.`;

  const userPrompt = `Parse the golf course scorecard from this BlueGolf page content for "${courseName}":

${finalMarkdown}

Extract all 18 holes with their par, yardage (from Blue/Back tees), and handicap index.
Return ONLY the JSON object with the parsed data. If the content does not contain a scorecard table, return { "error": "no_scorecard_data" }.`;

  console.log('Calling Lovable AI to parse scorecard...');

  const parseResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
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
    
    // Handle AI indicating no scorecard data was found
    if ((courseData as any).error === 'no_scorecard_data') {
      console.log('AI reported no scorecard data in page content');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'The scorecard data could not be read from BlueGolf. The page may be blocked or not contain scorecard information. Please try again or enter course details manually.',
          sourceUrl: formattedUrl
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!courseData.name || !courseData.holes || !Array.isArray(courseData.holes)) {
      throw new Error('Invalid course data structure');
    }

    courseData.holes = courseData.holes.map((hole, index) => ({
      number: hole.number || index + 1,
      par: hole.par || 4,
      yardage: hole.yardage || 350,
      handicapIndex: hole.handicapIndex || (index + 1)
    }));

    // Use search location as fallback if AI didn't extract one
    if ((!courseData.location || courseData.location === 'Location not specified') && searchLocation && searchLocation !== 'Location not specified') {
      courseData.location = searchLocation;
    }

    courseData.totalPar = courseData.holes.reduce((sum, h) => sum + h.par, 0);
    courseData.totalYardage = courseData.holes.reduce((sum, h) => sum + h.yardage, 0);

    console.log(`Parsed course: ${courseData.name}, Location: ${courseData.location}, Par ${courseData.totalPar}, ${courseData.totalYardage} yards`);

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

async function tryVerifiedCourseFallback(courseName: string): Promise<CourseData | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) return null;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await adminClient
      .from('verified_courses')
      .select('course_name, course_location, course_data, total_par, total_yardage')
      .ilike('course_name', `%${courseName.trim()}%`)
      .limit(1);

    if (error || !data || data.length === 0) return null;

    const row = data[0];
    const cd = row.course_data as any;
    
    if (cd && cd.holes && Array.isArray(cd.holes) && cd.holes.length > 0) {
      return {
        name: cd.name || row.course_name,
        location: cd.location || row.course_location,
        holes: cd.holes,
        totalPar: row.total_par || cd.totalPar || 0,
        totalYardage: row.total_yardage || cd.totalYardage || 0,
      };
    }

    return null;
  } catch (e) {
    console.error('Verified course fallback error:', e);
    return null;
  }
}

async function extractNamesAndLocationsWithAI(
  lovableKey: string,
  results: Array<{ url: string; title?: string; description?: string }>
): Promise<Record<string, { name: string; location: string }>> {
  const summaries = results.map((r, i) => 
    `${i + 1}. URL: ${r.url}\n   Title: ${r.title || 'N/A'}\n   Description: ${r.description || 'N/A'}`
  ).join('\n');

  const prompt = `You are a golf course expert. Given these BlueGolf search results, identify the full official name and physical location (City, State) of each golf course.

Use your knowledge of real golf courses to determine the correct city and state. The URL slug often contains the course identifier.

Return a JSON array:
[
  { "url": "the exact URL from the input", "name": "Full Course Name", "location": "City, ST" },
  ...
]

Rules:
- "name": full official course name, not "Course" or generic titles
- "location": real US city + 2-letter state (e.g. "Ponte Vedra Beach, FL")  
- Use your knowledge of golf courses — most well-known courses have known locations
- If you truly cannot determine the location, use "Location not specified"
- Return ONLY the JSON array

Search results:
${summaries}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI extraction failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content from AI');

  const parsed: Array<{ url: string; name: string; location: string }> = parseJsonFromContent(content);
  
  const map: Record<string, { name: string; location: string }> = {};
  for (const item of parsed) {
    if (item.url) {
      map[item.url] = { name: item.name, location: item.location };
    }
  }
  return map;
}

function parseJsonFromContent(content: string): any {
  let jsonStr = content;
  
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Fall through to regex extraction
  }

  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch { /* fall through */ }
  }

  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return JSON.parse(arrayMatch[0]);
  }

  return JSON.parse(jsonStr);
}
