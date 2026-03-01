import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';
import { useSavedPlayers } from '@/hooks/useSavedPlayers';
import { useSavedCourses } from '@/hooks/useSavedCourses';
import { useVerifiedCourses, VerifiedCourseResult } from '@/hooks/useVerifiedCourses';
import { searchCourse, fetchCourseDetails, courseDataToCourse } from '@/lib/api/courseSearch';
import { supabase } from '@/integrations/supabase/client';
import { Course } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, CalendarIcon, Plus, Minus, Trash2,
  Trophy, Users, Target, BarChart3, Loader2, Search, X, Check,
  MapPin, Globe, BadgeCheck,
} from 'lucide-react';
import {
  GAME_TYPE_INFO,
  DEFAULT_MODIFIED_STABLEFORD,
  type TournamentGameType,
  type TournamentGameConfig,
  type LeaderboardConfig,
  type TeamConfig,
  type TournamentSettings,
  type ModifiedStablefordValues,
  type RoundConfig,
  type RoundCourseData,
} from '@/services/tournamentScoringEngine';
import { cn } from '@/lib/utils';

// ── Wizard player type ──
interface WizardPlayer {
  id: string;
  name: string;
  handicap_index: number;
  source: 'saved' | 'search';
  user_id?: string | null;
}

// ── Team colors ──
const TEAM_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04',
  '#9333ea', '#0891b2', '#e11d48', '#65a30d',
];

const STEPS = [
  { label: 'Basic Info', icon: Trophy },
  { label: 'Players', icon: Users },
  { label: 'Rounds & Games', icon: Target },
  { label: 'Leaderboards', icon: BarChart3 },
];

const MATCHUP_FORMATS = [
  { value: '1v1' as const, label: '1 vs 1' },
  { value: '2v2' as const, label: '2 vs 2' },
  { value: '4v4' as const, label: '4 vs 4' },
  { value: 'ffa' as const, label: 'Free For All' },
];

// ════════════════════════════════════════════════
// Main Wizard Component
// ════════════════════════════════════════════════
const CreateTournamentWizard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createTournament, addPlayers } = useTournament();
  const { savedPlayers } = useSavedPlayers();
  const { savedCourses, favoriteCourses, nonFavoriteCourses } = useSavedCourses();
  const { searchVerifiedCourses } = useVerifiedCourses();

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1 state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [numRounds, setNumRounds] = useState(1);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  // Per-round course selection
  const [roundCourses, setRoundCourses] = useState<(Course | null)[]>([null]);
  const [courseSearchQueries, setCourseSearchQueries] = useState<string[]>(['']);
  const [courseSearchResults, setCourseSearchResults] = useState<Record<number, VerifiedCourseResult[]>>({});
  const [webSearchResults, setWebSearchResults] = useState<Record<number, { name: string; location: string; url: string }[]>>({});
  const [courseSearchLoading, setCourseSearchLoading] = useState<Record<number, boolean>>({});
  const [courseFetchLoading, setCourseFetchLoading] = useState<Record<number, boolean>>({});

  // Step 2 state
  const [players, setPlayers] = useState<WizardPlayer[]>([]);
  const [teamsEnabled, setTeamsEnabled] = useState(false);
  const [teams, setTeams] = useState<TeamConfig[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; display_name: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Step 3 state — per-round config
  const [roundsConfig, setRoundsConfig] = useState<RoundConfig[]>([]);

  // Step 4 state
  const [leaderboards, setLeaderboards] = useState<LeaderboardConfig[]>([]);

  // Sync roundCourses array size with numRounds
  useEffect(() => {
    setRoundCourses(prev => {
      const updated = [...prev];
      while (updated.length < numRounds) updated.push(null);
      return updated.slice(0, numRounds);
    });
    setCourseSearchQueries(prev => {
      const updated = [...prev];
      while (updated.length < numRounds) updated.push('');
      return updated.slice(0, numRounds);
    });
  }, [numRounds]);

  // Initialize rounds_config when entering Step 3
  useEffect(() => {
    if (step === 2) {
      setRoundsConfig(prev => {
        const updated: RoundConfig[] = [];
        for (let i = 0; i < numRounds; i++) {
          const existing = prev[i];
          const course = roundCourses[i];
          updated.push(existing ? {
            ...existing,
            course: course ? { id: course.id, name: course.name, location: course.location, holes: course.holes } : existing.course,
          } : {
            round_number: i + 1,
            course: course ? { id: course.id, name: course.name, location: course.location, holes: course.holes } : undefined,
            matchup_format: 'ffa',
            blind_teams: false,
            matchups: [],
            games: [],
          });
        }
        return updated;
      });
    }
  }, [step, numRounds, roundCourses]);

  // Auto-populate default leaderboard when entering Step 4
  useEffect(() => {
    if (step === 3 && leaderboards.length === 0) {
      const allGames = roundsConfig.flatMap(r => r.games);
      if (allGames.length > 0) {
        const first = allGames[0];
        const info = GAME_TYPE_INFO[first.type];
        setLeaderboards([{
          name: info.isTeam ? 'Team Standings' : 'Individual Standings',
          metric: first.type,
          scope: info.isTeam ? 'team' : 'individual',
          sort: info.defaultSort,
          show_rounds_breakdown: true,
        }]);
      }
    }
  }, [step]);

  // Auth guard
  useEffect(() => {
    if (!user) navigate('/auth');
  }, [user, navigate]);

  if (!user) return null;

  // ── Course search for a round ──
  const handleCourseSearch = async (roundIdx: number, query: string) => {
    setCourseSearchQueries(prev => prev.map((q, i) => i === roundIdx ? query : q));
    if (query.length < 2) {
      setCourseSearchResults(prev => ({ ...prev, [roundIdx]: [] }));
      setWebSearchResults(prev => ({ ...prev, [roundIdx]: [] }));
      return;
    }
    setCourseSearchLoading(prev => ({ ...prev, [roundIdx]: true }));
    try {
      // Search verified library
      const verified = await searchVerifiedCourses(query);
      setCourseSearchResults(prev => ({ ...prev, [roundIdx]: verified }));

      // Also search web
      const webResult = await searchCourse(query);
      if (webResult.success && webResult.courses) {
        setWebSearchResults(prev => ({ ...prev, [roundIdx]: webResult.courses! }));
      }
    } catch {
      // ignore
    } finally {
      setCourseSearchLoading(prev => ({ ...prev, [roundIdx]: false }));
    }
  };

  const selectVerifiedCourse = (roundIdx: number, vc: VerifiedCourseResult) => {
    const course: Course = {
      id: vc.id,
      name: vc.course_name,
      location: vc.course_location,
      holes: vc.course_data.holes || [],
    };
    setRoundCourses(prev => prev.map((c, i) => i === roundIdx ? course : c));
    setCourseSearchQueries(prev => prev.map((q, i) => i === roundIdx ? '' : q));
    setCourseSearchResults(prev => ({ ...prev, [roundIdx]: [] }));
    setWebSearchResults(prev => ({ ...prev, [roundIdx]: [] }));
  };

  const selectWebCourse = async (roundIdx: number, result: { name: string; location: string; url: string }) => {
    setCourseFetchLoading(prev => ({ ...prev, [roundIdx]: true }));
    try {
      const details = await fetchCourseDetails(result.url, result.name);
      if (details.success && details.course) {
        const course = courseDataToCourse(details.course);
        if (course) {
          setRoundCourses(prev => prev.map((c, i) => i === roundIdx ? course : c));
          setCourseSearchQueries(prev => prev.map((q, i) => i === roundIdx ? '' : q));
          setCourseSearchResults(prev => ({ ...prev, [roundIdx]: [] }));
          setWebSearchResults(prev => ({ ...prev, [roundIdx]: [] }));
          toast.success(`Loaded ${course.name}`);
        }
      } else {
        toast.error('Could not load course details');
      }
    } catch {
      toast.error('Failed to fetch course');
    } finally {
      setCourseFetchLoading(prev => ({ ...prev, [roundIdx]: false }));
    }
  };

  const selectSavedCourse = (roundIdx: number, course: Course) => {
    setRoundCourses(prev => prev.map((c, i) => i === roundIdx ? course : c));
  };

  const clearRoundCourse = (roundIdx: number) => {
    setRoundCourses(prev => prev.map((c, i) => i === roundIdx ? null : c));
  };

  // ── Search users ──
  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    if (term.length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    const { data } = await supabase.rpc('search_users_by_name', { search_term: term });
    setSearchResults(data || []);
    setIsSearching(false);
  };

  // ── Add player ──
  const addPlayer = (p: WizardPlayer) => {
    if (players.find(x => x.id === p.id)) return;
    setPlayers(prev => [...prev, p]);
  };

  const removePlayer = (id: string) => {
    setPlayers(prev => prev.filter(p => p.id !== id));
    setTeams(prev => prev.map(t => ({ ...t, playerIds: t.playerIds.filter(pid => pid !== id) })));
  };

  // ── Teams ──
  const addTeam = () => {
    const idx = teams.length;
    setTeams(prev => [...prev, { name: `Team ${idx + 1}`, color: TEAM_COLORS[idx % TEAM_COLORS.length], playerIds: [] }]);
  };

  const removeTeam = (idx: number) => setTeams(prev => prev.filter((_, i) => i !== idx));

  const updateTeamName = (idx: number, n: string) =>
    setTeams(prev => prev.map((t, i) => i === idx ? { ...t, name: n } : t));

  const assignPlayerToTeam = (playerId: string, teamIdx: number) => {
    setTeams(prev => prev.map((t, i) => ({
      ...t,
      playerIds: i === teamIdx
        ? (t.playerIds.includes(playerId) ? t.playerIds.filter(id => id !== playerId) : [...t.playerIds, playerId])
        : t.playerIds.filter(id => id !== playerId),
    })));
  };

  // ── Round config helpers ──
  const updateRoundConfig = (roundIdx: number, updates: Partial<RoundConfig>) => {
    setRoundsConfig(prev => prev.map((r, i) => i === roundIdx ? { ...r, ...updates } : r));
  };

  const toggleRoundGame = (roundIdx: number, type: TournamentGameType) => {
    setRoundsConfig(prev => prev.map((r, i) => {
      if (i !== roundIdx) return r;
      const exists = r.games.find(g => g.type === type);
      if (exists) return { ...r, games: r.games.filter(g => g.type !== type) };
      const info = GAME_TYPE_INFO[type];
      const config: TournamentGameConfig = {
        type,
        name: info.name,
        config: {
          handicap_pct: type.includes('net') || type === 'team_best_ball' ? 100 : undefined,
          stableford_values: type === 'modified_stableford' ? { ...DEFAULT_MODIFIED_STABLEFORD } : undefined,
        },
      };
      return { ...r, games: [...r.games, config] };
    }));
  };

  const updateRoundGameConfig = (roundIdx: number, type: TournamentGameType, key: string, value: any) => {
    setRoundsConfig(prev => prev.map((r, i) => {
      if (i !== roundIdx) return r;
      return { ...r, games: r.games.map(g => g.type === type ? { ...g, config: { ...g.config, [key]: value } } : g) };
    }));
  };

  const updateRoundStablefordValue = (roundIdx: number, type: TournamentGameType, field: keyof ModifiedStablefordValues, value: number) => {
    setRoundsConfig(prev => prev.map((r, i) => {
      if (i !== roundIdx) return r;
      return {
        ...r,
        games: r.games.map(g => {
          if (g.type !== type) return g;
          const sv = g.config.stableford_values || { ...DEFAULT_MODIFIED_STABLEFORD };
          return { ...g, config: { ...g.config, stableford_values: { ...sv, [field]: value } } };
        }),
      };
    }));
  };

  // ── Leaderboards ──
  const allUniqueGameTypes = Array.from(new Set(roundsConfig.flatMap(r => r.games.map(g => g.type))));

  const addLeaderboard = () => {
    if (leaderboards.length >= 5) return;
    const firstType = allUniqueGameTypes[0];
    setLeaderboards(prev => [...prev, {
      name: `Leaderboard ${prev.length + 1}`,
      metric: firstType || 'stroke_gross',
      scope: 'individual',
      sort: firstType ? GAME_TYPE_INFO[firstType].defaultSort : 'asc',
      show_rounds_breakdown: true,
    }]);
  };

  const removeLeaderboard = (idx: number) => setLeaderboards(prev => prev.filter((_, i) => i !== idx));

  const updateLeaderboard = (idx: number, updates: Partial<LeaderboardConfig>) => {
    setLeaderboards(prev => prev.map((lb, i) => i === idx ? { ...lb, ...updates } : lb));
  };

  // ── Filtered metric options based on scope ──
  const getMetricOptions = (scope: 'individual' | 'team') => {
    const filtered = allUniqueGameTypes
      .filter(type => {
        const info = GAME_TYPE_INFO[type];
        return scope === 'team' ? info.isTeam : !info.isTeam;
      })
      .map(type => ({ value: type, label: GAME_TYPE_INFO[type].name }));
    return [
      ...filtered,
      { value: 'daily_points', label: 'Daily Points' },
      { value: 'money_won', label: 'Money Won' },
    ];
  };

  // ── Validation ──
  const canAdvance = (): boolean => {
    switch (step) {
      case 0: return name.trim().length > 0;
      case 1: return players.length >= 2 && (!teamsEnabled || teams.length >= 2);
      case 2: return roundsConfig.every(r => r.games.length > 0);
      case 3: return leaderboards.length > 0;
      default: return false;
    }
  };

  // ── Submit ──
  const handleCreate = async () => {
    setIsSubmitting(true);
    try {
      // Flatten all games for backward compat
      const allGames = Array.from(
        new Map(roundsConfig.flatMap(r => r.games).map(g => [g.type, g])).values()
      );

      const settings: TournamentSettings = {
        description: description || undefined,
        num_rounds: numRounds,
        start_date: startDate?.toISOString(),
        end_date: endDate?.toISOString(),
        teams_enabled: teamsEnabled,
        teams: teamsEnabled ? teams : undefined,
        games: allGames,
        rounds_config: roundsConfig,
        leaderboards,
      };

      const t = await createTournament(name.trim(), 'points', players.length, settings);
      if (!t) { setIsSubmitting(false); return; }

      // Filter out the creator to prevent duplicate (createTournament already adds them as super_user)
      const playerRows = players
        .filter(p => p.user_id !== user.id)
        .map(p => ({
          tournament_id: t.id,
          user_id: p.user_id || null,
          player_name: p.name,
          handicap_index: p.handicap_index,
          role: 'player' as const,
        }));
      if (playerRows.length > 0) {
        await addPlayers(playerRows);
      }

      // Create rounds with course data
      for (const rc of roundsConfig) {
        const courseData = rc.course ? {
          name: rc.course.name,
          location: rc.course.location,
          holes: rc.course.holes,
        } : {};
        await supabase.from('tournament_rounds').insert([{
          tournament_id: t.id,
          round_number: rc.round_number,
          course_data: courseData as any,
          games_data: rc.games as any,
          status: 'SETUP' as const,
        }]);
      }

      navigate(`/tournament/${t.id}`);
    } catch {
      toast.error('Failed to create tournament');
      setIsSubmitting(false);
    }
  };

  // ════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => step > 0 ? setStep(step - 1) : navigate('/tournament')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">Create Tournament</h1>
            <p className="text-xs text-muted-foreground">{STEPS[step].label} — Step {step + 1} of 4</p>
          </div>
        </div>
        <div className="max-w-lg mx-auto mt-2">
          <Progress value={((step + 1) / 4) * 100} className="h-1.5" />
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 pb-28">
        {/* ═══ Step 1: Basic Info ═══ */}
        {step === 0 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <label className="text-sm font-medium text-foreground">Tournament Name *</label>
              <Input
                placeholder="e.g. Annual Buddies Trip"
                value={name}
                onChange={e => setName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Description</label>
              <Textarea
                placeholder="Optional description..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Number of Rounds</label>
              <div className="flex items-center gap-3 mt-1">
                <Button variant="outline" size="icon" onClick={() => setNumRounds(Math.max(1, numRounds - 1))} disabled={numRounds <= 1}>
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-2xl font-bold text-foreground w-12 text-center">{numRounds}</span>
                <Button variant="outline" size="icon" onClick={() => setNumRounds(Math.min(7, numRounds + 1))} disabled={numRounds >= 7}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {startDate ? format(startDate, 'MMM d, yyyy') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">End Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {endDate ? format(endDate, 'MMM d, yyyy') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      defaultMonth={startDate}
                      disabled={startDate ? (date) => date < startDate : undefined}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Per-round course selection */}
            <div className="space-y-4 pt-2">
              <label className="text-sm font-medium text-foreground">Course per Round</label>
              {Array.from({ length: numRounds }, (_, ri) => (
                <div key={ri} className="bg-card border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">Round {ri + 1}</span>
                    {roundCourses[ri] && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => clearRoundCourse(ri)}>
                        <X className="w-3 h-3" /> Clear
                      </Button>
                    )}
                  </div>

                  {roundCourses[ri] ? (
                    <div className="flex items-center gap-2 bg-accent/20 rounded-lg p-3">
                      <MapPin className="w-4 h-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{roundCourses[ri]!.name}</p>
                        {roundCourses[ri]!.location && (
                          <p className="text-xs text-muted-foreground truncate">{roundCourses[ri]!.location}</p>
                        )}
                      </div>
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    </div>
                  ) : (
                    <>
                      {/* Search input */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search courses..."
                          value={courseSearchQueries[ri] || ''}
                          onChange={e => handleCourseSearch(ri, e.target.value)}
                          className="pl-9"
                        />
                        {courseSearchLoading[ri] && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                      </div>

                      {/* Verified results */}
                      {(courseSearchResults[ri] || []).length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold uppercase text-muted-foreground">Verified Courses</span>
                          {courseSearchResults[ri].map(vc => (
                            <button
                              key={vc.id}
                              className="w-full text-left border rounded-lg p-2.5 hover:bg-accent/50 transition-colors"
                              onClick={() => selectVerifiedCourse(ri, vc)}
                            >
                              <div className="flex items-center gap-2">
                                <BadgeCheck className="w-4 h-4 text-green-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{vc.course_name}</p>
                                  <p className="text-xs text-muted-foreground">{vc.course_location} • Par {vc.total_par}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Web results */}
                      {(webSearchResults[ri] || []).length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold uppercase text-muted-foreground">Web Results</span>
                          {webSearchResults[ri].map((wr, wi) => (
                            <button
                              key={wi}
                              className="w-full text-left border rounded-lg p-2.5 hover:bg-accent/50 transition-colors"
                              onClick={() => selectWebCourse(ri, wr)}
                              disabled={!!courseFetchLoading[ri]}
                            >
                              <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{wr.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{wr.location}</p>
                                </div>
                                {courseFetchLoading[ri] && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Saved courses quick-select */}
                      {savedCourses.length > 0 && !courseSearchQueries[ri] && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold uppercase text-muted-foreground">Saved Courses</span>
                          <div className="flex flex-wrap gap-1.5">
                            {savedCourses.slice(0, 8).map(sc => (
                              <Badge
                                key={sc.id}
                                variant="outline"
                                className="cursor-pointer hover:bg-accent/50 text-foreground text-xs"
                                onClick={() => selectSavedCourse(ri, sc)}
                              >
                                <MapPin className="w-3 h-3 mr-1" /> {sc.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Step 2: Players ═══ */}
        {step === 1 && (
          <div className="space-y-5 animate-fade-in">
            {/* Search */}
            <div>
              <label className="text-sm font-medium text-foreground">Search Users</label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by display name..."
                  value={searchTerm}
                  onChange={e => handleSearch(e.target.value)}
                  className="pl-9"
                />
                {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
              {searchResults.length > 0 && (
                <div className="mt-1 border rounded-lg bg-card divide-y max-h-40 overflow-y-auto">
                  {searchResults
                    .filter(r => !players.find(p => p.user_id === r.id))
                    .map(r => (
                      <button
                        key={r.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 text-foreground"
                        onClick={() => {
                          addPlayer({ id: r.id, name: r.display_name, handicap_index: 0, source: 'search', user_id: r.id });
                          setSearchTerm('');
                          setSearchResults([]);
                        }}
                      >
                        {r.display_name}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Saved players quick-add */}
            {savedPlayers.length > 0 && (
              <div>
                <label className="text-sm font-medium text-foreground">My Saved Players</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {savedPlayers
                    .filter(sp => !players.find(p => p.name === sp.name))
                    .slice(0, 12)
                    .map(sp => (
                      <Badge
                        key={sp.id}
                        variant="outline"
                        className="cursor-pointer hover:bg-accent/50 text-foreground"
                        onClick={() => addPlayer({
                          id: sp.id,
                          name: sp.name,
                          handicap_index: sp.handicap_index,
                          source: 'saved',
                          user_id: sp.linked_user_id,
                        })}
                      >
                        <Plus className="w-3 h-3 mr-1" /> {sp.name}
                      </Badge>
                    ))}
                </div>
              </div>
            )}

            {/* Player list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">
                  Players ({players.length})
                  {players.length < 2 && <span className="text-destructive ml-1">— min 2 required</span>}
                </label>
              </div>
              <div className="space-y-2">
                {players.map(p => (
                  <div key={p.id} className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2">
                    <span className="flex-1 text-sm font-medium text-foreground truncate">{p.name}</span>
                    <Input
                      type="number"
                      value={p.handicap_index}
                      onChange={e => setPlayers(prev => prev.map(x => x.id === p.id ? { ...x, handicap_index: parseFloat(e.target.value) || 0 } : x))}
                      className="w-20 text-center text-sm"
                      step="0.1"
                    />
                    <span className="text-xs text-muted-foreground">HCP</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removePlayer(p.id)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Teams toggle */}
            <div className="bg-card border rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-foreground">Enable Teams</label>
                  <p className="text-xs text-muted-foreground">Required for team-based games</p>
                </div>
                <Switch checked={teamsEnabled} onCheckedChange={setTeamsEnabled} />
              </div>

              {teamsEnabled && (
                <div className="space-y-3 pt-2 border-t">
                  {teams.map((team, i) => {
                    const assignedToOtherTeams = new Set(
                      teams.flatMap((t, ti) => ti !== i ? t.playerIds : [])
                    );
                    const availablePlayers = players.filter(
                      p => team.playerIds.includes(p.id) || !assignedToOtherTeams.has(p.id)
                    );

                    return (
                      <div key={i} className="bg-secondary/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                          <Input
                            value={team.name}
                            onChange={e => updateTeamName(i, e.target.value)}
                            className="h-8 text-sm"
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeTeam(i)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {availablePlayers.map(p => {
                            const inThisTeam = team.playerIds.includes(p.id);
                            return (
                              <Badge
                                key={p.id}
                                variant={inThisTeam ? 'default' : 'outline'}
                                className="cursor-pointer text-xs"
                                onClick={() => assignPlayerToTeam(p.id, i)}
                              >
                                {inThisTeam && <Check className="w-3 h-3 mr-1" />}
                                {p.name}
                              </Badge>
                            );
                          })}
                          {availablePlayers.length === 0 && (
                            <span className="text-xs text-muted-foreground italic">All players assigned to other teams</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <Button variant="outline" size="sm" className="w-full gap-1" onClick={addTeam}>
                    <Plus className="w-4 h-4" /> Add Team
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ Step 3: Rounds & Games ═══ */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            <p className="text-sm text-muted-foreground">
              Configure each round's matchup format and scoring games.
              {!teamsEnabled && ' Enable teams in Step 2 to unlock team games.'}
            </p>

            <Accordion type="multiple" defaultValue={roundsConfig.map((_, i) => `round-${i}`)}>
              {roundsConfig.map((rc, ri) => (
                <AccordionItem key={ri} value={`round-${ri}`}>
                  <AccordionTrigger className="text-sm font-semibold">
                    <div className="flex items-center gap-2">
                      Round {ri + 1}
                      {rc.course?.name && (
                        <span className="text-xs font-normal text-muted-foreground">— {rc.course.name}</span>
                      )}
                      {rc.games.length > 0 && (
                        <Badge variant="secondary" className="text-[10px]">{rc.games.length} game{rc.games.length !== 1 ? 's' : ''}</Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                    {/* Matchup format */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Matchup Format</label>
                      <div className="grid grid-cols-4 gap-2 mt-1">
                        {MATCHUP_FORMATS.map(mf => (
                          <button
                            key={mf.value}
                            onClick={() => updateRoundConfig(ri, { matchup_format: mf.value })}
                            className={cn(
                              'text-xs border rounded-lg py-2 px-1 transition-all text-center',
                              rc.matchup_format === mf.value
                                ? 'border-primary bg-accent/30 ring-1 ring-primary text-foreground'
                                : 'bg-card hover:bg-accent/10 text-muted-foreground'
                            )}
                          >
                            {mf.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Blind teams toggle */}
                    <div className="flex items-center justify-between bg-secondary/30 rounded-lg p-3">
                      <div>
                        <span className="text-xs font-medium text-foreground">Blind Teams</span>
                        <p className="text-[10px] text-muted-foreground">Matchups can be across groups not playing together</p>
                      </div>
                      <Switch
                        checked={rc.blind_teams}
                        onCheckedChange={v => updateRoundConfig(ri, { blind_teams: v })}
                      />
                    </div>

                    {/* Games selection */}
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Individual Games</label>
                      <div className="space-y-1.5 mt-1">
                        {(Object.entries(GAME_TYPE_INFO) as [TournamentGameType, typeof GAME_TYPE_INFO[TournamentGameType]][])
                          .filter(([, info]) => !info.isTeam)
                          .map(([type, info]) => {
                            const selected = !!rc.games.find(g => g.type === type);
                            const game = rc.games.find(g => g.type === type);
                            return (
                              <div key={type}>
                                <button
                                  onClick={() => toggleRoundGame(ri, type)}
                                  className={cn(
                                    'w-full text-left border rounded-xl p-3 transition-all',
                                    selected ? 'border-primary bg-accent/30 ring-1 ring-primary' : 'bg-card hover:bg-accent/10'
                                  )}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <span className="font-medium text-sm text-foreground">{info.name}</span>
                                      <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>
                                    </div>
                                    {selected && <Check className="w-5 h-5 text-primary shrink-0" />}
                                  </div>
                                </button>
                                {selected && type === 'stroke_net' && game && (
                                  <div className="ml-4 mt-2 flex items-center gap-2">
                                    <label className="text-xs text-muted-foreground">Handicap %</label>
                                    <Input
                                      type="number"
                                      value={game.config.handicap_pct ?? 100}
                                      onChange={e => updateRoundGameConfig(ri, type, 'handicap_pct', parseInt(e.target.value) || 100)}
                                      className="w-20 h-7 text-xs text-center"
                                      min={0} max={100}
                                    />
                                  </div>
                                )}
                                {selected && type === 'modified_stableford' && game && (
                                  <div className="ml-4 mt-2 space-y-1">
                                    {(['eagle', 'birdie', 'par', 'bogey', 'double_bogey'] as const).map(field => (
                                      <div key={field} className="flex items-center gap-2">
                                        <label className="text-xs text-muted-foreground capitalize w-24">{field.replace('_', ' ')}</label>
                                        <Input
                                          type="number"
                                          value={game.config.stableford_values?.[field] ?? DEFAULT_MODIFIED_STABLEFORD[field]}
                                          onChange={e => updateRoundStablefordValue(ri, type, field, parseInt(e.target.value) || 0)}
                                          className="w-20 h-7 text-xs text-center"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team Games</label>
                      <div className="space-y-1.5 mt-1">
                        {(Object.entries(GAME_TYPE_INFO) as [TournamentGameType, typeof GAME_TYPE_INFO[TournamentGameType]][])
                          .filter(([, info]) => info.isTeam)
                          .map(([type, info]) => {
                            const disabled = !teamsEnabled;
                            const selected = !!rc.games.find(g => g.type === type);
                            const game = rc.games.find(g => g.type === type);
                            return (
                              <div key={type}>
                                <button
                                  onClick={() => !disabled && toggleRoundGame(ri, type)}
                                  disabled={disabled}
                                  className={cn(
                                    'w-full text-left border rounded-xl p-3 transition-all',
                                    disabled && 'opacity-50 cursor-not-allowed',
                                    selected ? 'border-primary bg-accent/30 ring-1 ring-primary' : 'bg-card hover:bg-accent/10'
                                  )}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <span className="font-medium text-sm text-foreground">{info.name}</span>
                                      <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>
                                    </div>
                                    {selected && <Check className="w-5 h-5 text-primary shrink-0" />}
                                  </div>
                                </button>
                                {selected && (type === 'team_stroke_net' || type === 'team_best_ball') && game && (
                                  <div className="ml-4 mt-2 flex items-center gap-2">
                                    <label className="text-xs text-muted-foreground">Handicap %</label>
                                    <Input
                                      type="number"
                                      value={game.config.handicap_pct ?? 100}
                                      onChange={e => updateRoundGameConfig(ri, type, 'handicap_pct', parseInt(e.target.value) || 100)}
                                      className="w-20 h-7 text-xs text-center"
                                      min={0} max={100}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}

        {/* ═══ Step 4: Leaderboards ═══ */}
        {step === 3 && (
          <div className="space-y-5 animate-fade-in">
            <p className="text-sm text-muted-foreground">
              Configure up to 5 leaderboards. The first is the default view.
            </p>

            {leaderboards.map((lb, i) => {
              const metricOptions = getMetricOptions(lb.scope);
              const isMetricValid = metricOptions.some(o => o.value === lb.metric);

              return (
                <div key={i} className="bg-card border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {i === 0 && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                      <span className="text-xs text-muted-foreground">Leaderboard {i + 1}</span>
                    </div>
                    {leaderboards.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLeaderboard(i)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>

                  <Input
                    value={lb.name}
                    onChange={e => updateLeaderboard(i, { name: e.target.value })}
                    placeholder="Leaderboard name"
                    className="text-sm"
                  />

                  {/* Scope FIRST */}
                  <div>
                    <label className="text-xs text-muted-foreground">Scope</label>
                    <Select value={lb.scope} onValueChange={v => {
                      const newScope = v as 'individual' | 'team';
                      const newMetricOptions = getMetricOptions(newScope);
                      const metricStillValid = newMetricOptions.some(o => o.value === lb.metric);
                      updateLeaderboard(i, {
                        scope: newScope,
                        metric: metricStillValid ? lb.metric : (newMetricOptions[0]?.value || 'stroke_gross'),
                      });
                    }}>
                      <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual" className="text-xs">Individual</SelectItem>
                        <SelectItem value="team" className="text-xs">Team</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Metric filtered by scope */}
                  <div>
                    <label className="text-xs text-muted-foreground">Metric</label>
                    <Select value={isMetricValid ? lb.metric : metricOptions[0]?.value} onValueChange={v => {
                      const gameInfo = GAME_TYPE_INFO[v as TournamentGameType];
                      updateLeaderboard(i, {
                        metric: v,
                        sort: gameInfo?.defaultSort || lb.sort,
                      });
                    }}>
                      <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {metricOptions.map(o => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">Sort</label>
                      <Select value={lb.sort} onValueChange={v => updateLeaderboard(i, { sort: v as 'asc' | 'desc' })}>
                        <SelectTrigger className="text-xs h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="asc" className="text-xs">Low → High</SelectItem>
                          <SelectItem value="desc" className="text-xs">High → Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">Per-round</label>
                      <Switch
                        checked={lb.show_rounds_breakdown}
                        onCheckedChange={v => updateLeaderboard(i, { show_rounds_breakdown: v })}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {leaderboards.length < 5 && (
              <Button variant="outline" className="w-full gap-1" onClick={addLeaderboard}>
                <Plus className="w-4 h-4" /> Add Leaderboard
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t px-4 py-3">
        <div className="max-w-lg mx-auto flex gap-3">
          {step > 0 && (
            <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          )}
          {step < 3 ? (
            <Button className="flex-1" onClick={() => setStep(step + 1)} disabled={!canAdvance()}>
              Next <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button className="flex-1" onClick={handleCreate} disabled={!canAdvance() || isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trophy className="w-4 h-4 mr-1" />}
              Create Tournament
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateTournamentWizard;
