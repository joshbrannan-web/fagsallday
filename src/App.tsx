import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
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
import { calculateRoundTotals } from './services/gameEngine';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useRounds } from '@/hooks/useRounds';
import { useSavedCourses } from '@/hooks/useSavedCourses';
import { useSavedPlayers } from '@/hooks/useSavedPlayers';
import { AppContext, AppState } from './contexts/AppContext';

// Re-export useApp for backward compatibility
export { useApp } from './contexts/AppContext';

const queryClient = new QueryClient();

const AppContent: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { 
    rounds, 
    currentRound: dbCurrentRound, 
    isLoading: roundsLoading, 
    createRound, 
    updateRound, 
    deleteRound: dbDeleteRound,
    finishRound: dbFinishRound,
    loadRound
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

  // Fallback to localStorage for non-authenticated users
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

  // Determine which data source to use
  const isAuthenticated = !!user;
  const currentRound = isAuthenticated ? dbCurrentRound : localCurrentRound;
  const savedCourses = isAuthenticated ? dbSavedCourses : localSavedCourses;
  const favoriteCourses = isAuthenticated ? dbFavoriteCourses : [];
  const nonFavoriteCourses = isAuthenticated ? dbNonFavoriteCourses : localSavedCourses;
  const roundHistory = isAuthenticated ? rounds : localRoundHistory;
  const isLoading = authLoading || (isAuthenticated && (roundsLoading || coursesLoading));

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

  const startNewRound = async (course: Course, players: Player[], games: GameSettings[]) => {
    // Auto-save all players when authenticated
    if (isAuthenticated) {
      for (const player of players) {
        if (player.name.trim()) {
          await addSavedPlayer(player.name, player.handicapIndex || 0, player.tee);
        }
      }
      await createRound(course, players, games);
    } else {
      const newRound: Round = {
        id: Date.now().toString(),
        course,
        players,
        games,
        scores: {},
        gameData: {},
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
    newScores[holeNumber] = {
      ...newScores[holeNumber],
      [playerId]: score
    };

    if (isAuthenticated) {
      await updateRound(currentRound.id, { scores: newScores });
    } else {
      setLocalCurrentRound(prev => prev ? { ...prev, scores: newScores } : null);
    }
  };

  const updateGameData = async (gameId: string, holeNumber: number, key: string, value: any) => {
    if (!currentRound) return;

    const newGameData = { ...currentRound.gameData };
    if (!newGameData[gameId]) newGameData[gameId] = {};
    if (!newGameData[gameId][holeNumber]) newGameData[gameId][holeNumber] = {};
    newGameData[gameId][holeNumber] = {
      ...newGameData[gameId][holeNumber],
      [key]: value
    };

    if (isAuthenticated) {
      await updateRound(currentRound.id, { gameData: newGameData });
    } else {
      setLocalCurrentRound(prev => prev ? { ...prev, gameData: newGameData } : null);
    }
  };

  const updateGameDataBatch = async (gameId: string, holeNumber: number, updates: Record<string, any>) => {
    if (!currentRound) return;

    const newGameData = { ...currentRound.gameData };
    if (!newGameData[gameId]) newGameData[gameId] = {};
    if (!newGameData[gameId][holeNumber]) newGameData[gameId][holeNumber] = {};
    newGameData[gameId][holeNumber] = {
      ...newGameData[gameId][holeNumber],
      ...updates
    };

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
    // Non-authenticated users cannot use favorites
  };

  const isFavorite = (courseId: string) => {
    if (isAuthenticated) {
      return dbIsFavorite(courseId);
    }
    return false;
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
    finishRound,
    loadPastRound,
    deleteRound,
    saveCourse,
    updateCourse,
    deleteCourse,
    toggleFavorite,
    isFavorite,
    roundTotals,
    isLoading
  };

  return (
    <AppContext.Provider value={value}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/players" element={<Players />} />
          <Route path="/setup" element={<SetupWizard />} />
          <Route path="/active" element={<ActiveRound />} />
          <Route path="/scorecard" element={<Scorecard />} />
          <Route path="/summary" element={<RoundSummary />} />
          <Route path="/history" element={<RoundHistory />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </HashRouter>
    </AppContext.Provider>
  );
};

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
