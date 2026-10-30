import React, { useState } from 'react';
import { Course } from '@/types';
import { Button } from '@/components/ui/button';
import { BadgeCheck, ChevronDown, Globe, Loader2 } from 'lucide-react';

interface Props {
  name: string;
  subtitle?: string;
  verified?: boolean;
  /** Pre-loaded course (verified results). */
  course?: Course | null;
  /** Lazily load course details (web results). */
  loadCourse?: () => Promise<Course | null>;
  onSelect: (course: Course) => void;
  disabled?: boolean;
  previewHoles?: number;
}

/** Search result row with an expandable preview of the first few holes (Par + Handicap). */
const CourseResultPreview: React.FC<Props> = ({
  name, subtitle, verified, course: initial, loadCourse, onSelect, disabled, previewHoles = 4,
}) => {
  const [open, setOpen] = useState(false);
  const [course, setCourse] = useState<Course | null>(initial ?? null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const ensureLoaded = async (): Promise<Course | null> => {
    if (course) return course;
    if (!loadCourse) return null;
    setLoading(true);
    setFailed(false);
    try {
      const c = await loadCourse();
      setCourse(c);
      if (!c) setFailed(true);
      return c;
    } catch {
      setFailed(true);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) await ensureLoaded();
  };

  const handleUse = async () => {
    const c = await ensureLoaded();
    if (c) onSelect(c);
  };

  const holes = (course?.holes || []).slice(0, previewHoles);
  const totalPar = course?.holes.reduce((s, h) => s + (h.par || 0), 0);

  return (
    <div className={`rounded-lg border ${verified ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className="w-full p-3 flex items-center gap-2 text-left disabled:opacity-50"
      >
        {verified
          ? <BadgeCheck className="w-4 h-4 text-primary shrink-0" />
          : <Globe className="w-4 h-4 text-muted-foreground shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{name}</div>
          {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
        </div>
        <span className="text-xs text-primary shrink-0">Preview</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading holes…
            </div>
          )}
          {failed && !loading && (
            <p className="text-xs text-destructive">Couldn't load hole details for this course.</p>
          )}
          {course && holes.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-center border-collapse">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left font-medium py-1 pr-2">Hole</th>
                      {holes.map(h => <th key={h.number} className="font-medium py-1">{h.number}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border">
                      <td className="text-left py-1 pr-2 text-muted-foreground">Par</td>
                      {holes.map(h => <td key={h.number} className="py-1 font-semibold">{h.par}</td>)}
                    </tr>
                    <tr className="border-t border-border">
                      <td className="text-left py-1 pr-2 text-muted-foreground">HCP</td>
                      {holes.map(h => <td key={h.number} className="py-1">{h.handicapIndex || '–'}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                {course.holes.length} holes · Par {totalPar}
              </p>
            </>
          )}
          <Button size="sm" className="w-full" onClick={handleUse} disabled={disabled || loading || failed}>
            Use this course
          </Button>
        </div>
      )}
    </div>
  );
};

export default CourseResultPreview;
