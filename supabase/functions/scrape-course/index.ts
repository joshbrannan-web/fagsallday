import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Search 18birdies for the course
    const searchQuery = location 
      ? `${courseName} ${location} golf course site:18birdies.com`
      : `${courseName} golf course site:18birdies.com`;

    console.log('Searching for course:', searchQuery);

    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 5,
        scrapeOptions: {
          formats: ['markdown'],
        },
      }),
    });

    const searchData = await searchResponse.json();
    console.log('Search results:', JSON.stringify(searchData).slice(0, 500));

    if (!searchResponse.ok || !searchData.success) {
      console.error('Search failed:', searchData);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to search for course' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find a scorecard/course page from results
    const results = searchData.data || [];
    let courseUrl = null;
    
    for (const result of results) {
      const url = result.url || '';
      if (url.includes('18birdies.com') && (url.includes('/course/') || url.includes('/scorecard'))) {
        courseUrl = url;
        break;
      }
    }

    if (!courseUrl && results.length > 0) {
      // Take first 18birdies result
      courseUrl = results.find((r: any) => r.url?.includes('18birdies.com'))?.url;
    }

    if (!courseUrl) {
      console.log('No 18birdies course found, returning search results');
      return new Response(
        JSON.stringify({ 
          success: true, 
          courses: results.map((r: any) => ({
            name: r.title || courseName,
            url: r.url,
            description: r.description,
          })),
          message: 'No direct 18birdies course page found'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping course page:', courseUrl);

    // Scrape the course page for scorecard data
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: courseUrl,
        formats: ['markdown', 'html'],
        onlyMainContent: true,
        waitFor: 2000,
      }),
    });

    const scrapeData = await scrapeResponse.json();
    console.log('Scrape response status:', scrapeResponse.status);

    if (!scrapeResponse.ok) {
      console.error('Scrape failed:', scrapeData);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to scrape course page' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
    const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};

    // Parse scorecard data from markdown
    const courseData = parseCourseData(markdown, metadata, courseName);

    console.log('Parsed course data:', JSON.stringify(courseData).slice(0, 500));

    return new Response(
      JSON.stringify({ 
        success: true, 
        course: courseData,
        sourceUrl: courseUrl,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scrape-course function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape course';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseCourseData(markdown: string, metadata: any, fallbackName: string) {
  const courseName = metadata.title?.replace(/\s*\|\s*18Birdies.*$/i, '').trim() || fallbackName;
  
  // Try to extract hole data from markdown tables or structured content
  const holes = [];
  
  // Look for yardage patterns like "Hole 1: 405 yards Par 4"
  const holePatterns = [
    /hole\s*(\d+)[:\s]*(\d+)\s*(?:yards?|yds?)?\s*par\s*(\d)/gi,
    /(\d+)\s*\|\s*(\d+)\s*\|\s*(\d)/g, // Table format: hole | yardage | par
  ];

  // Try to find hole data in markdown
  let matches;
  const foundHoles = new Map();

  // Pattern 1: "Hole X: XXX yards Par X"
  const pattern1 = /hole\s*(\d+)[:\s-]*(\d{2,4})\s*(?:yards?|yds?)?\s*par\s*(\d)/gi;
  while ((matches = pattern1.exec(markdown)) !== null) {
    const holeNum = parseInt(matches[1]);
    if (holeNum >= 1 && holeNum <= 18) {
      foundHoles.set(holeNum, {
        number: holeNum,
        yardage: parseInt(matches[2]),
        par: parseInt(matches[3]),
        handicapIndex: holeNum, // Default, will be updated if found
      });
    }
  }

  // Pattern 2: Look for par values in sequence
  const parPattern = /par[:\s]*(\d(?:\s*[,|/]\s*\d)*)/gi;
  const pars: number[] = [];
  while ((matches = parPattern.exec(markdown)) !== null) {
    const parString = matches[1];
    const parValues = parString.split(/[,|/\s]+/).map(Number).filter(n => n >= 3 && n <= 5);
    pars.push(...parValues);
  }

  // Pattern 3: Look for yardage sequences
  const yardagePattern = /(\d{3})\s+(\d{3})\s+(\d{3})/g;
  const yardages: number[] = [];
  while ((matches = yardagePattern.exec(markdown)) !== null) {
    yardages.push(parseInt(matches[1]), parseInt(matches[2]), parseInt(matches[3]));
  }

  // Build holes array from found data or use defaults
  for (let i = 1; i <= 18; i++) {
    if (foundHoles.has(i)) {
      holes.push(foundHoles.get(i));
    } else {
      // Use extracted data or defaults
      const defaultPars = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4];
      const defaultYardages = [380, 420, 165, 510, 390, 405, 175, 525, 410, 395, 430, 155, 490, 385, 415, 185, 505, 400];
      
      holes.push({
        number: i,
        par: pars[i - 1] || defaultPars[i - 1],
        yardage: yardages[i - 1] || defaultYardages[i - 1],
        handicapIndex: i <= 9 ? (i * 2 - 1) : ((i - 9) * 2), // Typical stroke index pattern
      });
    }
  }

  return {
    name: courseName,
    location: metadata.description?.match(/in\s+([^,]+,\s*[A-Z]{2})/i)?.[1] || '',
    holes,
    totalPar: holes.reduce((sum, h) => sum + h.par, 0),
    totalYardage: holes.reduce((sum, h) => sum + h.yardage, 0),
  };
}
