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
    location: string;
    url: string;
  }>;
  sourceUrl?: string;
  message?: string;
}

export async function searchCourse(courseName: string, location?: string): Promise<CourseSearchResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('search-course', {
      body: { courseName, location, mode: 'search' },
    });

    if (error) {
      console.error('Error calling search-course:', error);
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

export async function fetchCourseDetails(courseUrl: string, courseName: string): Promise<CourseSearchResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('search-course', {
      body: { 
        mode: 'fetch', 
        selectedCourseUrl: courseUrl,
        courseName 
      },
    });

    if (error) {
      console.error('Error fetching course details:', error);
      return { success: false, error: error.message };
    }

    return data;
  } catch (error) {
    console.error('Error fetching course details:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch course details' 
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

export async function searchVerifiedLibrary(query: string): Promise<Array<{
  id: string;
  course_name: string;
  course_location: string;
  course_data: Course;
  total_par: number;
  total_yardage: number;
}>> {
  if (!query.trim()) return [];

  try {
    const { data, error } = await supabase
      .from('verified_courses')
      .select('id, course_name, course_location, course_data, total_par, total_yardage')
      .ilike('course_name', `%${query.trim()}%`)
      .limit(10);

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      course_name: row.course_name,
      course_location: row.course_location,
      course_data: row.course_data as Course,
      total_par: row.total_par,
      total_yardage: row.total_yardage,
    }));
  } catch (error) {
    console.error('Error searching verified library:', error);
    return [];
  }
}
