import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Course, Hole } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { useVerifiedCourses, VerifiedCourseResult } from '@/hooks/useVerifiedCourses';
import { searchCourse, fetchCourseDetails, courseDataToCourse } from '@/lib/api/courseSearch';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Search, Camera, Loader2, Star, BadgeCheck, MapPin, ChevronDown, X, Check,
} from 'lucide-react';

interface TeeBox {
  name: string;
  color: string;
  rating?: number;
  slope?: number;
  holes: { number: number; yardage: number; par: number; handicapIndex: number }[];
  totalYardage: number;
  totalPar: number;
}

interface CoursePickerProps {
  selectedCourse: Course | null;
  onCourseSelected: (course: Course) => void;
}

const getTeeColorClass = (color: string): string => {
  const map: Record<string, string> = {
    black: 'bg-black', blue: 'bg-blue-600', white: 'bg-white border border-gray-300',
    gold: 'bg-yellow-500', yellow: 'bg-yellow-500', red: 'bg-red-600',
    green: 'bg-green-600', silver: 'bg-gray-400',
  };
  return map[color.toLowerCase()] || 'bg-gray-400';
};

type PickerMode = 'idle' | 'searching' | 'results' | 'tee-select';

const CoursePicker: React.FC<CoursePickerProps> = ({ selectedCourse, onCourseSelected }) => {
  const { savedCourses, favoriteCourses, nonFavoriteCourses } = useApp();
  const { searchVerifiedCourses } = useVerifiedCourses();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<PickerMode>(selectedCourse ? 'idle' : 'idle');
  const [isChanging, setIsChanging] = useState(!selectedCourse);
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // Search results
  const [verifiedResults, setVerifiedResults] = useState<VerifiedCourseResult[]>([]);
  const [externalResults, setExternalResults] = useState<Array<{ name: string; location: string; url: string }>>([]);

  // Tee box selection
  const [teeBoxes, setTeeBoxes] = useState<TeeBox[]>([]);
  const [scannedName, setScannedName] = useState('');
  const [scannedLocation, setScannedLocation] = useState('');

  const selectCourse = useCallback((course: Course) => {
    onCourseSelected(course);
    setIsChanging(false);
    setQuery('');
    setVerifiedResults([]);
    setExternalResults([]);
  }, [onCourseSelected]);

  // If selectedCourse changes externally, sync state
  useEffect(() => {
    if (selectedCourse) setIsChanging(false);
  }, [selectedCourse]);

  const handleSearch = async () => {
    if (!query.trim()) { toast.error('Enter a course name'); return; }
    setIsSearching(true);
    setVerifiedResults([]);
    setExternalResults([]);
    setMode('searching');

    // Verified library (fast)
    const verified = await searchVerifiedCourses(query);
    setVerifiedResults(verified);

    // External search
    try {
      const result = await searchCourse(query, location || undefined);
      if (result.success) {
        if (result.course) {
          const course = courseDataToCourse(result.course);
          if (course) { selectCourse(course); toast.success(`Loaded ${course.name}!`); setIsSearching(false); return; }
        } else if (result.courses?.length) {
          setExternalResults(result.courses);
        }
      }
    } catch (e) { console.error(e); }

    setMode('results');
    setIsSearching(false);
  };

  const handleSelectExternal = async (url: string, name: string) => {
    setIsLoading(true);
    try {
      const result = await fetchCourseDetails(url, name);
      if (result.success && result.course) {
        const course = courseDataToCourse(result.course);
        if (course) { selectCourse(course); toast.success(`Loaded ${course.name}!`); }
      } else {
        toast.error('Failed to load course details');
      }
    } catch { toast.error('Error fetching course'); }
    setIsLoading(false);
  };

  const handleSelectVerified = (r: VerifiedCourseResult) => {
    const cd = r.course_data;
    const course: Course = {
      id: crypto.randomUUID(),
      name: cd.name || r.course_name,
      location: cd.location || r.course_location,
      holes: cd.holes || [],
    };
    selectCourse(course);
    toast.success(`Loaded ${course.name} from verified library!`);
  };

  const handleScan = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    toast.info('Analyzing scorecard…');
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((res, rej) => {
        reader.onload = () => res((reader.result as string).split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke('parse-scorecard', { body: { imageBase64: base64 } });
      if (error || !data?.success) { toast.error(data?.error || 'Failed to parse scorecard'); setIsLoading(false); return; }
      const parsed = data.data;
      setScannedName(parsed.courseName || 'Scanned Course');
      setScannedLocation(parsed.location || '');
      setTeeBoxes(parsed.teeBoxes);
      if (parsed.teeBoxes.length > 1) {
        setMode('tee-select');
        toast.success(`Found ${parsed.teeBoxes.length} tee boxes!`);
      } else {
        handleSelectTeeBox(parsed.teeBoxes[0], parsed.courseName, parsed.location);
      }
    } catch { toast.error('Failed to process scorecard'); }
    setIsLoading(false);
  };

  const handleSelectTeeBox = (tb: TeeBox, name?: string, loc?: string) => {
    const course: Course = {
      id: crypto.randomUUID(),
      name: name || scannedName || 'Scanned Course',
      location: loc || scannedLocation || '',
      holes: tb.holes.map(h => ({ number: h.number, par: h.par, yardage: h.yardage, handicapIndex: h.handicapIndex })),
    };
    selectCourse(course);
    toast.success('Course loaded from scan!');
    setMode('idle');
  };

  // --- Summary when course is selected ---
  if (selectedCourse && !isChanging) {
    const totalPar = selectedCourse.holes.reduce((s, h) => s + h.par, 0);
    const totalYds = selectedCourse.holes.reduce((s, h) => s + h.yardage, 0);
    return (
      <div className="bg-accent/30 rounded-lg p-3 flex items-center justify-between">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{selectedCourse.name}</p>
          {selectedCourse.location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedCourse.location}</p>
          )}
          <p className="text-xs text-muted-foreground">Par {totalPar} · {totalYds.toLocaleString()} yds · {selectedCourse.holes.length} holes</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsChanging(true)}>Change</Button>
      </div>
    );
  }

  // --- Tee box selection ---
  if (mode === 'tee-select') {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">Select Tee Box</p>
        <div className="grid grid-cols-2 gap-2">
          {teeBoxes.map(tb => (
            <button
              key={tb.name}
              onClick={() => handleSelectTeeBox(tb)}
              className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-accent/50 text-left"
            >
              <div className={`w-4 h-4 rounded-full ${getTeeColorClass(tb.color)}`} />
              <div>
                <p className="text-sm font-medium">{tb.name}</p>
                <p className="text-xs text-muted-foreground">Par {tb.totalPar} · {tb.totalYardage} yds</p>
              </div>
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setMode('idle')}>Cancel</Button>
      </div>
    );
  }

  // --- Main picker UI ---
  return (
    <div className="space-y-3">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* Search row */}
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search course name…"
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button size="icon" variant="outline" onClick={handleSearch} disabled={isSearching}>
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
        <Button size="icon" variant="outline" onClick={handleScan} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
        </Button>
      </div>

      {/* Saved courses toggle */}
      {savedCourses.length > 0 && (
        <div>
          <button
            onClick={() => setShowSaved(!showSaved)}
            className="flex items-center gap-1 text-xs text-primary"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${showSaved ? 'rotate-180' : ''}`} />
            My Saved Courses ({savedCourses.length})
          </button>
          {showSaved && (
            <div className="mt-1 max-h-40 overflow-y-auto space-y-1">
              {favoriteCourses.map(c => (
                <button key={c.id} onClick={() => selectCourse(c)} className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 text-left text-sm">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
              {nonFavoriteCourses.map(c => (
                <button key={c.id} onClick={() => selectCourse(c)} className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 text-left text-sm">
                  <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search results */}
      {(verifiedResults.length > 0 || externalResults.length > 0) && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {verifiedResults.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Verified Courses</p>
              {verifiedResults.map(r => (
                <button key={r.id} onClick={() => handleSelectVerified(r)} className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 text-left text-sm">
                  <BadgeCheck className="w-4 h-4 text-green-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate">{r.course_name}</p>
                    <p className="text-xs text-muted-foreground">Par {r.total_par} · {r.total_yardage} yds</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {externalResults.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Web Results</p>
              {externalResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectExternal(r.url, r.name)}
                  disabled={isLoading}
                  className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 text-left text-sm disabled:opacity-50"
                >
                  <Search className="w-3 h-3 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.location}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cancel change button when editing existing */}
      {selectedCourse && isChanging && (
        <Button variant="ghost" size="sm" onClick={() => setIsChanging(false)} className="text-xs">
          <X className="w-3 h-3 mr-1" /> Cancel
        </Button>
      )}
    </div>
  );
};

export default CoursePicker;
