import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Course } from '@/types';
import { toast } from 'sonner';

interface DbCourse {
  id: string;
  user_id: string;
  course_data: any;
  is_favorite: boolean;
  created_at: string;
}

export const useSavedCourses = () => {
  const { user } = useAuth();
  const [savedCourses, setSavedCourses] = useState<Course[]>([]);
  const [favoriteCourseIds, setFavoriteCourseIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const fetchCourses = useCallback(async () => {
    if (!user) {
      setSavedCourses([]);
      setFavoriteCourseIds(new Set());
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('saved_courses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_favorite', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const courses = (data || []).map((db: DbCourse) => db.course_data as Course);
      const favoriteIds = new Set(
        (data || [])
          .filter((db: DbCourse) => db.is_favorite)
          .map((db: DbCourse) => (db.course_data as Course).id)
      );
      
      setSavedCourses(courses);
      setFavoriteCourseIds(favoriteIds);
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

  const updateCourse = async (course: Course) => {
    if (!user) {
      const localCourses = JSON.parse(localStorage.getItem('fg_saved_courses') || '[]');
      const updated = localCourses.map((c: Course) => c.id === course.id ? course : c);
      localStorage.setItem('fg_saved_courses', JSON.stringify(updated));
      setSavedCourses(prev => prev.map(c => c.id === course.id ? course : c));
      return true;
    }

    try {
      // Find the DB record by course_data.id
      const { data: records, error: findError } = await supabase
        .from('saved_courses')
        .select('id, course_data')
        .eq('user_id', user.id);

      if (findError) throw findError;

      const record = records?.find(r => (r.course_data as unknown as Course).id === course.id);
      if (!record) {
        // If course doesn't exist, save it instead
        return saveCourse(course);
      }

      const { error } = await supabase
        .from('saved_courses')
        .update({ course_data: course as any })
        .eq('id', record.id);

      if (error) throw error;

      setSavedCourses(prev => prev.map(c => c.id === course.id ? course : c));
      toast.success('Course details saved!');
      return true;
    } catch (error) {
      console.error('Error updating course:', error);
      toast.error('Failed to update course');
      return false;
    }
  };

  const toggleFavorite = async (courseId: string) => {
    if (!user) {
      toast.error('Sign in to favorite courses');
      return false;
    }

    try {
      // Find the DB record by course_data.id
      const { data: records, error: findError } = await supabase
        .from('saved_courses')
        .select('id, course_data, is_favorite')
        .eq('user_id', user.id);

      if (findError) throw findError;

      const record = records?.find(r => (r.course_data as unknown as Course).id === courseId);
      if (!record) {
        toast.error('Course not found');
        return false;
      }

      const newFavoriteStatus = !record.is_favorite;

      const { error } = await supabase
        .from('saved_courses')
        .update({ is_favorite: newFavoriteStatus })
        .eq('id', record.id);

      if (error) throw error;

      setFavoriteCourseIds(prev => {
        const newSet = new Set(prev);
        if (newFavoriteStatus) {
          newSet.add(courseId);
        } else {
          newSet.delete(courseId);
        }
        return newSet;
      });

      toast.success(newFavoriteStatus ? 'Added to favorites!' : 'Removed from favorites');
      return true;
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
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
      setFavoriteCourseIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(courseId);
        return newSet;
      });
      return true;
    } catch (error) {
      console.error('Error deleting course:', error);
      toast.error('Failed to delete course');
      return false;
    }
  };

  const isFavorite = (courseId: string) => favoriteCourseIds.has(courseId);

  const favoriteCourses = savedCourses.filter(c => favoriteCourseIds.has(c.id));
  const nonFavoriteCourses = savedCourses.filter(c => !favoriteCourseIds.has(c.id));

  return {
    savedCourses,
    favoriteCourses,
    nonFavoriteCourses,
    isLoading,
    saveCourse,
    updateCourse,
    deleteCourse,
    toggleFavorite,
    isFavorite,
    refetch: fetchCourses
  };
};
