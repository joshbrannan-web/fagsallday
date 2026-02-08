import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Course } from '@/types';
import { toast } from 'sonner';

export interface VerifiedCourseResult {
  id: string;
  course_name: string;
  course_location: string;
  course_data: Course;
  total_par: number;
  total_yardage: number;
  verified_at: string;
}

export const useVerifiedCourses = () => {
  const { user } = useAuth();
  const [isSearching, setIsSearching] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const searchVerifiedCourses = useCallback(async (query: string): Promise<VerifiedCourseResult[]> => {
    if (!query.trim()) return [];

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('verified_courses')
        .select('id, course_name, course_location, course_data, total_par, total_yardage, verified_at')
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
        verified_at: row.verified_at,
      }));
    } catch (error) {
      console.error('Error searching verified courses:', error);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, []);

  const verifyCourse = useCallback(async (course: Course): Promise<boolean> => {
    if (!user) {
      toast.error('Sign in to verify courses');
      return false;
    }

    // Check if course has real hole data (not all defaults)
    const hasRealData = course.holes.some(h => h.par !== 4 || h.yardage !== 350);
    if (!hasRealData) {
      toast.error('Course needs real scorecard data before verifying');
      return false;
    }

    setIsVerifying(true);
    try {
      const totalPar = course.holes.reduce((sum, h) => sum + h.par, 0);
      const totalYardage = course.holes.reduce((sum, h) => sum + h.yardage, 0);

      const { error } = await supabase
        .from('verified_courses')
        .insert({
          course_name: course.name,
          course_location: course.location || '',
          course_data: course as any,
          verified_by: user.id,
          total_par: totalPar,
          total_yardage: totalYardage,
        } as any);

      if (error) {
        if (error.code === '23505') {
          toast.info('This course is already verified!');
          return false;
        }
        throw error;
      }

      toast.success('Course verified and shared with all players!');
      return true;
    } catch (error) {
      console.error('Error verifying course:', error);
      toast.error('Failed to verify course');
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, [user]);

  const checkIfVerified = useCallback(async (courseName: string): Promise<boolean> => {
    if (!courseName.trim()) return false;

    try {
      const { data, error } = await supabase
        .from('verified_courses')
        .select('id')
        .ilike('course_name', courseName.trim())
        .limit(1);

      if (error) throw error;
      return (data || []).length > 0;
    } catch (error) {
      console.error('Error checking verified status:', error);
      return false;
    }
  }, []);

  return {
    searchVerifiedCourses,
    verifyCourse,
    checkIfVerified,
    isSearching,
    isVerifying,
  };
};
