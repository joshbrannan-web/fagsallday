import { useState, useEffect, useRef } from 'react';
import type { FC } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Round, Player, Course, GameSettings } from './types';
import Landing from './components/Landing';
import SetupWizard from './components/SetupWizard';
import ActiveRound from './components/ActiveRound';
import RoundSummary from './components/RoundSummary';
import RoundHistory from './components/RoundHistory';
import Scorecard from './components/Scorecard';
import Auth from './pages/Auth';
import Players from './pages/Players';
import Admin from './pages/Admin';
import AdminRoundView from './pages/AdminRoundView';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';
import TournamentAdmin from './pages/TournamentAdmin';
import TournamentAdminDashboard from './pages/TournamentAdminDashboard';
import TournamentAdminScorecard from './pages/TournamentAdminScorecard';
import TournamentAdminScoreboards from './pages/TournamentAdminScoreboards';
import TournamentAdminLiveView from './pages/TournamentAdminLiveView';
import Tournament from './pages/Tournament';
import TournamentScoreboards from './pages/TournamentScoreboards';
import TournamentGroupScorecard from './pages/TournamentGroupScorecard';
import TournamentBuildRoundWizard from './components/tournament/TournamentBuildRoundWizard';
import CreateTournamentWizard from './components/tournament-admin/CreateTournamentWizard';
import { calculateRoundTotals } from './services/gameEngine';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useRounds } from '@/hooks/useRounds';
import { useSavedCourses } from '@/hooks/useSavedCourses';
import { useSavedPlayers } from '@/hooks/useSavedPlayers';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { offlineStorage } from '@/services/offlineStorage';
import { supabase } from '@/integrations/supabase/client';
import { AppContext, AppState } from './contexts/AppContext';
import ConnectionStatusBar from './components/ConnectionStatusBar';
import { toast } from 'sonner';
import { useVersionCheck } from '@/hooks/useVersionCheck';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } }
});

// Round recovery component - must be inside HashRouter for useNavigate
const RoundRecovery: FC<{
  currentRound: Round | null;
  isLoading: boolean;
  recoveryChecked: { current: boolean };
  showRecoveryDialog: boolean;
  setShowRecoveryDialog: (v: boolean) => void;
  recoveryRound: Round | null;
  setRecoveryRound: (r: Round | null) => void;
  setLocalCurrentRound: (r: Round | null) => void;
  isAuthenticated: boolean;
  loadPastRound: (r: Round) => void;
}> = ({ currentRound, isLoading, recoveryChecked, showRecoveryDialog, setShowRecoveryDialog, recoveryRound, setRecoveryRound, setLocalCurrentRound, isAuthenticated, loadPastRound }) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading || recoveryChecked.current || currentRound) return;
    if (!isAuthenticated) return;
    recoveryChecked.current = true;

    const cached = offlineStorage.getCachedRound();
    if (!cached || cached.status !== 'ACTIVE') return;

    const ageMs = Date.now() - (cached.startTime || 0);
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    if (ageMs < TWENTY_FOUR_HOURS) {
      if (isAuthenticated) {
        loadPastRound(cached);
      } else {
        setLocalCurrentRound(cached);
      }
      toast.success('Resuming your round...');
      navigate('/active');
    } else {
      setRecoveryRound(cached);
      setShowRecoveryDialog(true);
    }
  }, [isLoading, currentRound]);

  const handleResume = () => {
    if (!recoveryRound) return;
    if (isAuthenticated) {
      loadPastRound(recoveryRound);
    } else {
      setLocalCurrentRound(recoveryRound);
    }
    setShowRecoveryDialog(false);
    setRecoveryRound(null);
    toast.success('Resuming your round...');
    navigate('/active');
  };

  const handleDiscard = () => {
    offlineStorage.clearCachedRound();
    setShowRecoveryDialog(false);
    setRecoveryRound(null);
  };

  return (
    <AlertDialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unfinished Round Found</AlertDialogTitle>
          <AlertDialogDescription>
            You have an unfinished round from{' '}
            {recoveryRound?.startTime
              ? new Date(recoveryRound.startTime).toLocaleDateString()
              : 'a previous session'}
            . Would you like to resume or discard it?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleDiscard}>Discard</AlertDialogCancel>
          <AlertDialogAction onClick={handleResume}>Resume</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const AppContent: FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { 
    rounds, 
    currentRound: dbCurrentRound, 
    isLoading: roundsLoading, 
    createRound, 
    updateRound, 
    deleteRound: dbDeleteRound,
    finishRound: dbFinishRound,
    loadRound,
    clearLoadedRound: dbClearLoadedRound,
    lockRound: dbLockRound,
    unlockRound: dbUnlockRound,
    toggleRoundFavorite: dbToggleRoundFavorite,
    refetch: refetchRounds
  } = useRounds();
  const { 
    savedCourses: dbSavedCourses,
    favoriteCourses: dbFavoriteCourses,
    nonFavoriteCourses: dbNonFavoriteCourses,
    isLoading: coursesLoading, 
    saveCourse: dbSaveCourse,
    updateCourse: dbUpdateCourse,
    deleteCourse: dbDeleteCourse,
    toggleFavorite: dbToggleFavorite,
    isFavorite: dbIsFavorite
  } = useSavedCourses();
  const { addPlayer: addSavedPlayer } = useSavedPlayers();
  const isOnline = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [localCurrentRound, setLocalCurrentRound] = useState<Round | null>(() => {
    const saved = localStorage.getItem('fg_current_round');
    return saved ? JSON.parse(saved) : null;
  });

  const [localSavedCourses, setLocalSavedCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem('fg_saved_courses');
    return saved ? JSON.parse(saved) : [];
  });

  const [localRoundHistory, setLocalRoundHistory] = useState<Round[]>(() => {
    const saved = localStorage.getItem('fg_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [roundTotals, setRoundTotals] = useState<{ [playerId: string]: number }>({});

  const isAuthenticated = !!user;
  const currentRound = isAuthenticated ? dbCurrentRound : localCurrentRound;
  const savedCourses = isAuthenticated ? dbSavedCourses : localSavedCourses;
  const favoriteCourses = isAuthenticated ? dbFavoriteCourses : [];
  const nonFavoriteCourses = isAuthenticated ? dbNonFavoriteCourses : localSavedCourses;
  const roundHistory = isAuthenticated ? rounds : localRoundHistory;
  const isLoading = authLoading || (isAuthenticated && (roundsLoading || coursesLoading));
  const pendingSyncCount = offlineStorage.getPendingSyncCount();
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [recoveryRound, setRecoveryRound] = useState<Round | null>(null);
  const recoveryChecked = useRef(false);

  // Sync pending changes when coming back online
  useEffect(() => {
    if (isOnline && isAuthenticated && user) {
      const syncPendingChanges = async () => {
        const queue = offlineStorage.getSyncQueue();
        if (queue.length === 0) return;

        setIsSyncing(true);
        const successfulIds: string[] = [];

        for (const item of queue) {
          try {
            const { error } = await supabase
              .from('rounds')
              .update(item.data)
              .eq('id', item.roundId)
              .eq('user_id', user.id);

            if (!error) {
              successfulIds.push(item.id);
            }
          } catch (error) {
            console.error('Failed to sync item:', error);
          }
        }

        offlineStorage.removeFromSyncQueue(successfulIds);
        setIsSyncing(false);

        if (successfulIds.length > 0) {
          toast.success(`Synced ${successfulIds.length} offline changes`);
        }
      };

      syncPendingChanges();
    }
  }, [isOnline, isAuthenticated, user]);

  // Drain tournament sync queue when coming back online
  useEffect(() => {
    if (!isOnline || !isAuthenticated) return;

    const drainTournamentQueue = async () => {
      const queue = offlineStorage.getTournamentSyncQueue();
      if (queue.length === 0) return;

      const successIds: string[] = [];
      for (const item of queue) {
        try {
          const { error } = await supabase.from('tournament_hole_scores').upsert({
            tournament_group_id: item.tournamentGroupId,
            tournament_player_id: item.tournamentPlayerId,
            hole_number: item.holeNumber,
            gross_score: item.grossScore,
            is_super_user_override: false,
          }, { onConflict: 'tournament_group_id,tournament_player_id,hole_number' });
          if (!error) successIds.push(item.id);
        } catch (e) {
          console.warn('Failed to drain tournament sync item:', e);
        }
      }
      if (successIds.length > 0) {
        offlineStorage.removeTournamentSyncItems(successIds);
        toast.success(`Synced ${successIds.length} tournament scores`);
      }
    };

    drainTournamentQueue();
  }, [isOnline, isAuthenticated]);

  // Cache the active round for offline recovery
  useEffect(() => {
    if (currentRound && currentRound.status === 'ACTIVE') {
      offlineStorage.cacheRound(currentRound);
    }
  }, [currentRound]);

  // Calculate totals when round changes
  useEffect(() => {
    if (currentRound) {
      setRoundTotals(calculateRoundTotals(currentRound));
    }
  }, [currentRound]);

  // Persist local data for non-authenticated users
  useEffect(() => {
    if (!isAuthenticated && localCurrentRound) {
      if (localCurrentRound.status === 'ACTIVE') {
        localStorage.setItem('fg_current_round', JSON.stringify(localCurrentRound));

        setLocalRoundHistory(prev => {
          const index = prev.findIndex(r => r.id === localCurrentRound.id);
          if (index !== -1) {
            if (JSON.stringify(prev[index]) === JSON.stringify(localCurrentRound)) return prev;
            const newHistory = [...prev];
            newHistory[index] = localCurrentRound;
            return newHistory;
          }
          return [localCurrentRound, ...prev];
        });
      }
    } else if (!isAuthenticated) {
      localStorage.removeItem('fg_current_round');
    }
  }, [localCurrentRound, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      localStorage.setItem('fg_saved_courses', JSON.stringify(localSavedCourses));
    }
  }, [localSavedCourses, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      localStorage.setItem('fg_history', JSON.stringify(localRoundHistory));
    }
  }, [localRoundHistory, isAuthenticated]);

  const startNewRound = async (course: Course, players: Player[], games: GameSettings[], initialGameData?: Record<string, any>) => {
    if (isAuthenticated) {
      for (const player of players) {
        if (player.name.trim()) {
          await addSavedPlayer(player.name, player.handicapIndex || 0, player.tee);
        }
      }
      await createRound(course, players, games, initialGameData);
    } else {
      const newRound: Round = {
        id: Date.now().toString(),
        course,
        players,
        games,
        scores: {},
        gameData: initialGameData || {},
        status: 'ACTIVE',
        startTime: Date.now()
      };
      setLocalCurrentRound(newRound);
    }
  };

  const updateScore = async (holeNumber: number, playerId: string, score: number) => {
    if (!currentRound) return;
    const newScores = { ...currentRound.scores };
    if (!newScores[holeNumber]) newScores[holeNumber] = {};
    newScores[holeNumber] = { ...newScores[holeNumber], [playerId]: score };
    if (isAuthenticated) {
      // Optimistic local update
      await updateRound(currentRound.id, { scores: newScores });
      // Atomic DB patch — only touches scores[hole][player]
      try {
        await supabase.rpc('patch_round_scores', {
          p_round_id: currentRound.id,
          p_hole: holeNumber,
          p_player_id: playerId,
          p_score: score,
        });
      } catch (err) {
        console.warn('patch_round_scores RPC failed, relying on optimistic update:', err);
      }
    } else {
      setLocalCurrentRound(prev => prev ? { ...prev, scores: newScores } : null);
    }
  };

  const updateGameData = async (gameId: string, holeNumber: number, key: string, value: any) => {
    if (!currentRound) return;
    const newGameData = { ...currentRound.gameData };
    if (!newGameData[gameId]) newGameData[gameId] = {};
    if (!newGameData[gameId][holeNumber]) newGameData[gameId][holeNumber] = {};
    newGameData[gameId][holeNumber] = { ...newGameData[gameId][holeNumber], [key]: value };
    if (isAuthenticated) {
      await updateRound(currentRound.id, { gameData: newGameData });
      try {
        await supabase.rpc('patch_round_game_data', {
          p_round_id: currentRound.id,
          p_game_id: gameId,
          p_hole: holeNumber,
          p_updates: { [key]: value },
        });
      } catch (err) {
        console.warn('patch_round_game_data RPC failed, relying on optimistic update:', err);
      }
    } else {
      setLocalCurrentRound(prev => prev ? { ...prev, gameData: newGameData } : null);
    }
  };

  const updateGameDataBatch = async (gameId: string, holeNumber: number, updates: Record<string, any>) => {
    if (!currentRound) return;
    const newGameData = { ...currentRound.gameData };
    if (!newGameData[gameId]) newGameData[gameId] = {};
    if (!newGameData[gameId][holeNumber]) newGameData[gameId][holeNumber] = {};
    newGameData[gameId][holeNumber] = { ...newGameData[gameId][holeNumber], ...updates };
    if (isAuthenticated) {
      await updateRound(currentRound.id, { gameData: newGameData });
    } else {
      setLocalCurrentRound(prev => prev ? { ...prev, gameData: newGameData } : null);
    }
  };

  const finishRound = async () => {
    if (!currentRound) return;
    if (isAuthenticated) {
      await dbFinishRound(currentRound.id);
    } else {
      const completedRound = { ...currentRound, status: 'COMPLETE' as const };
      setLocalRoundHistory(prev => {
        const index = prev.findIndex(r => r.id === currentRound.id);
        if (index !== -1) {
          const newHistory = [...prev];
          newHistory[index] = completedRound;
          return newHistory;
        }
        return [completedRound, ...prev];
      });
      setLocalCurrentRound(null);
    }
    offlineStorage.clearCachedRound();
  };

  const loadPastRound = (round: Round) => {
    if (isAuthenticated) {
      loadRound(round);
    } else {
      setLocalCurrentRound(round);
    }
  };

  const deleteRound = async (roundId: string) => {
    if (isAuthenticated) {
      await dbDeleteRound(roundId);
    } else {
      setLocalRoundHistory(prev => prev.filter(r => r.id !== roundId));
      if (localCurrentRound?.id === roundId) {
        setLocalCurrentRound(null);
      }
    }
  };

  const saveCourse = async (course: Course) => {
    if (isAuthenticated) {
      await dbSaveCourse(course);
    } else {
      setLocalSavedCourses(prev => {
        const exists = prev.find(c => c.id === course.id);
        if (exists) {
          return prev.map(c => c.id === course.id ? course : c);
        }
        return [...prev, course];
      });
    }
  };

  const deleteCourse = async (courseId: string) => {
    if (isAuthenticated) {
      await dbDeleteCourse(courseId);
    } else {
      setLocalSavedCourses(prev => prev.filter(c => c.id !== courseId));
    }
  };

  const updateCourse = async (course: Course) => {
    if (isAuthenticated) {
      await dbUpdateCourse(course);
    } else {
      setLocalSavedCourses(prev => prev.map(c => c.id === course.id ? course : c));
    }
  };

  const toggleFavorite = async (courseId: string) => {
    if (isAuthenticated) {
      await dbToggleFavorite(courseId);
    }
  };

  const isFavorite = (courseId: string) => {
    if (isAuthenticated) {
      return dbIsFavorite(courseId);
    }
    return false;
  };

  const changeGames = async (newGames: GameSettings[], initialGameData?: Record<string, any>) => {
    if (!currentRound) return;
    // Preserve _TOURNAMENT_META when changing games so tournament context isn't lost
    const existingMeta = (currentRound.gameData as any)?.['_TOURNAMENT_META'];
    const mergedGameData = { ...(initialGameData || {}), ...(existingMeta ? { _TOURNAMENT_META: existingMeta } : {}) };
    const updates = { games: newGames, scores: {} as Record<number, Record<string, number>>, gameData: mergedGameData };
    if (isAuthenticated) {
      await updateRound(currentRound.id, updates);
    } else {
      setLocalCurrentRound(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const updateRoundCourse = async (courseName: string, courseLocation: string) => {
    if (!currentRound) return;
    const updatedCourse = { ...currentRound.course, name: courseName, location: courseLocation };
    if (isAuthenticated) {
      await updateRound(currentRound.id, { course: updatedCourse });
    } else {
      setLocalCurrentRound(prev => prev ? { ...prev, course: updatedCourse } : null);
      setLocalRoundHistory(prev => prev.map(r => r.id === currentRound.id ? { ...r, course: updatedCourse } : r));
    }
  };

  const lockRound = async () => {
    if (!currentRound) return;
    if (isAuthenticated) {
      await dbLockRound(currentRound.id);
    } else {
      const lockedRound = { ...currentRound, status: 'LOCKED' as const };
      setLocalCurrentRound(lockedRound);
      setLocalRoundHistory(prev => prev.map(r => r.id === currentRound.id ? lockedRound : r));
    }
  };

  const unlockRound = async () => {
    if (!currentRound) return;
    if (isAuthenticated) {
      await dbUnlockRound(currentRound.id);
    } else {
      const unlockedRound = { ...currentRound, status: 'COMPLETE' as const };
      setLocalCurrentRound(unlockedRound);
      setLocalRoundHistory(prev => prev.map(r => r.id === currentRound.id ? unlockedRound : r));
    }
  };

  const value: AppState = {
    currentRound,
    savedCourses,
    favoriteCourses,
    nonFavoriteCourses,
    roundHistory,
    startNewRound,
    updateScore,
    updateGameData,
    updateGameDataBatch,
    changeGames,
    finishRound,
    loadPastRound,
    deleteRound,
    saveCourse,
    updateCourse,
    deleteCourse,
    clearLoadedRound: isAuthenticated ? dbClearLoadedRound : () => {
      setLocalCurrentRound(null);
    },
    toggleFavorite,
    isFavorite,
    updateRoundCourse,
    lockRound,
    unlockRound,
    toggleRoundFavorite: isAuthenticated ? (roundId: string) => dbToggleRoundFavorite(roundId) : () => {},
    roundTotals,
    isLoading,
    refetchRounds: refetchRounds
  };

  return (
    <AppContext.Provider value={value}>
      <ConnectionStatusBar />
      <RoundRecovery
        currentRound={currentRound}
        isLoading={isLoading}
        recoveryChecked={recoveryChecked}
        showRecoveryDialog={showRecoveryDialog}
        setShowRecoveryDialog={setShowRecoveryDialog}
        recoveryRound={recoveryRound}
        setRecoveryRound={setRecoveryRound}
        setLocalCurrentRound={setLocalCurrentRound}
        isAuthenticated={isAuthenticated}
        loadPastRound={loadPastRound}
      />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/players" element={<Players />} />
        <Route path="/setup" element={<SetupWizard />} />
        <Route path="/active" element={<ActiveRound />} />
        <Route path="/scorecard" element={<Scorecard />} />
        <Route path="/summary" element={<RoundSummary />} />
        <Route path="/history" element={<RoundHistory />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/round/:roundId" element={<AdminRoundView />} />
        <Route path="/tournament-admin" element={<TournamentAdmin />} />
        <Route path="/tournament-admin/create" element={<CreateTournamentWizard />} />
        <Route path="/tournament-admin/:tournamentId" element={<TournamentAdminDashboard />} />
        <Route path="/tournament-admin/:tournamentId/scoreboards" element={<TournamentAdminScoreboards />} />
        <Route path="/tournament-admin/:tournamentId/round/:roundId/group/:groupId" element={<TournamentAdminScorecard />} />
        <Route path="/tournament-admin/:tournamentId/round/:roundId/group/:groupId/live" element={<TournamentAdminLiveView />} />
        <Route path="/tournament" element={<Tournament />} />
        <Route path="/tournament/:joinCode/scoreboards" element={<TournamentScoreboards />} />
        <Route path="/tournament/:joinCode/round/:roundId/group/:groupId" element={<TournamentGroupScorecard />} />
        <Route path="/tournament/:joinCode/build-round" element={<TournamentBuildRoundWizard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppContext.Provider>
  );
};

const App: FC = () => {
  useVersionCheck();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <HashRouter>
            <AppContent />
          </HashRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
