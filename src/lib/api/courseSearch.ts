import { supabase } from '@/integrations/supabase/client';
import type { Course, Hole } from '@/types';

interface CourseSearchResponse {
  success: boolean;
  error?: string;
  course?: {
    name: string;
    location: string;
    holes: Hole[];
    totalPar: number;
    totalYardage: number;
  };
  courses?: Array<{
    name: string;
    url: string;
    description: string;
  }>;
  sourceUrl?: string;
  message?: string;
}

export async function searchCourse(courseName: string, location?: string): Promise<CourseSearchResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('search-course-perplexity', {
      body: { courseName, location },
    });

    if (error) {
      console.error('Error calling scrape-course:', error);
      return { success: false, error: error.message };
    }

    return data;
  } catch (error) {
    console.error('Error searching course:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to search course' 
    };
  }
}

export function courseDataToCourse(courseData: CourseSearchResponse['course']): Course | null {
  if (!courseData) return null;

  return {
    id: crypto.randomUUID(),
    name: courseData.name,
    location: courseData.location,
    holes: courseData.holes.map((hole, index) => ({
      number: index + 1,
      par: hole.par,
      yardage: hole.yardage,
      handicapIndex: hole.handicapIndex,
    })),
  };
}
