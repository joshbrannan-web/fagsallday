import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Course } from '@/types';
import { toast } from 'sonner';

interface DbCourse {
  id: string;
  user_id: string;
  course_data: any;
  created_at: string;
}

export const useSavedCourses = () => {
  const { user } = useAuth();
  const [savedCourses, setSavedCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCourses = useCallback(async () => {
    if (!user) {
      setSavedCourses([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('saved_courses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const courses = (data || []).map((db: DbCourse) => db.course_data as Course);
      setSavedCourses(courses);
    } catch (error) {
      console.error('Error fetching saved courses:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const saveCourse = async (course: Course) => {
    if (!user) {
      // Save to localStorage for non-authenticated users
      const localCourses = JSON.parse(localStorage.getItem('fg_saved_courses') || '[]');
      const exists = localCourses.find((c: Course) => c.id === course.id);
      if (!exists) {
        localStorage.setItem('fg_saved_courses', JSON.stringify([...localCourses, course]));
      }
      return true;
    }

    try {
      // Check if course already exists
      const exists = savedCourses.find(c => c.id === course.id);
      if (exists) return true;

      const { error } = await supabase
        .from('saved_courses')
        .insert({
          user_id: user.id,
          course_data: course as unknown as Record<string, unknown>
        } as any);

      if (error) throw error;

      setSavedCourses(prev => [course, ...prev]);
      return true;
    } catch (error) {
      console.error('Error saving course:', error);
      toast.error('Failed to save course');
      return false;
    }
  };

  const deleteCourse = async (courseId: string) => {
    if (!user) {
      const localCourses = JSON.parse(localStorage.getItem('fg_saved_courses') || '[]');
      localStorage.setItem('fg_saved_courses', JSON.stringify(localCourses.filter((c: Course) => c.id !== courseId)));
      setSavedCourses(prev => prev.filter(c => c.id !== courseId));
      return true;
    }

    try {
      // Find the DB record by course_data.id
      const { data: records, error: findError } = await supabase
        .from('saved_courses')
        .select('id, course_data')
        .eq('user_id', user.id);

      if (findError) throw findError;

      const record = records?.find(r => (r.course_data as unknown as Course).id === courseId);
      if (!record) {
        setSavedCourses(prev => prev.filter(c => c.id !== courseId));
        return true;
      }

      const { error } = await supabase
        .from('saved_courses')
        .delete()
        .eq('id', record.id);

      if (error) throw error;

      setSavedCourses(prev => prev.filter(c => c.id !== courseId));
      return true;
    } catch (error) {
      console.error('Error deleting course:', error);
      toast.error('Failed to delete course');
      return false;
    }
  };

  return {
    savedCourses,
    isLoading,
    saveCourse,
    deleteCourse,
    refetch: fetchCourses
  };
};
