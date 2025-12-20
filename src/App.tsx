import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Round, Player, Course, GameSettings } from './types';
import Landing from './components/Landing';
import SetupWizard from './components/SetupWizard';
import ActiveRound from './components/ActiveRound';
import RoundSummary from './components/RoundSummary';
import RoundHistory from './components/RoundHistory';
import Scorecard from './components/Scorecard';
import { calculateRoundTotals } from './services/gameEngine';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// --- Context ---

interface AppState {
  currentRound: Round | null;
  savedCourses: Course[];
  roundHistory: Round[];
  startNewRound: (course: Course, players: Player[], games: GameSettings[]) => void;
  updateScore: (holeNumber: number, playerId: string, score: number) => void;
  updateGameData: (gameId: string, holeNumber: number, data: any) => void;
  finishRound: () => void;
  loadPastRound: (round: Round) => void;
  deleteRound: (roundId: string) => void;
  saveCourse: (course: Course) => void;
  deleteCourse: (courseId: string) => void;
  roundTotals: { [playerId: string]: number };
}

const AppContext = createContext<AppState | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

const queryClient = new QueryClient();

const AppContent: React.FC = () => {
  const [currentRound, setCurrentRound] = useState<Round | null>(() => {
    const saved = localStorage.getItem('fg_current_round');
    return saved ? JSON.parse(saved) : null;
  });

  const [savedCourses, setSavedCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem('fg_saved_courses');
    return saved ? JSON.parse(saved) : [];
  });

  const [roundHistory, setRoundHistory] = useState<Round[]>(() => {
    const saved = localStorage.getItem('fg_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [roundTotals, setRoundTotals] = useState<{ [playerId: string]: number }>({});

  useEffect(() => {
    if (currentRound) {
      if (currentRound.status === 'ACTIVE') {
        localStorage.setItem('fg_current_round', JSON.stringify(currentRound));

        // Auto-save active round to history
        setRoundHistory(prev => {
          const index = prev.findIndex(r => r.id === currentRound.id);
          if (index !== -1) {
            if (JSON.stringify(prev[index]) === JSON.stringify(currentRound)) return prev;
            const newHistory = [...prev];
            newHistory[index] = currentRound;
            return newHistory;
          }
          return [currentRound, ...prev];
        });
      }
      setRoundTotals(calculateRoundTotals(currentRound));
    } else {
      localStorage.removeItem('fg_current_round');
    }
  }, [currentRound]);

  useEffect(() => {
    localStorage.setItem('fg_saved_courses', JSON.stringify(savedCourses));
  }, [savedCourses]);

  useEffect(() => {
    localStorage.setItem('fg_history', JSON.stringify(roundHistory));
  }, [roundHistory]);

  const startNewRound = (course: Course, players: Player[], games: GameSettings[]) => {
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
    setCurrentRound(newRound);
  };

  const updateScore = (holeNumber: number, playerId: string, score: number) => {
    setCurrentRound(prev => {
      if (!prev) return null;
      const newScores = { ...prev.scores };
      if (!newScores[holeNumber]) newScores[holeNumber] = {};

      newScores[holeNumber] = {
        ...newScores[holeNumber],
        [playerId]: score
      };

      return { ...prev, scores: newScores };
    });
  };

  const updateGameData = (gameId: string, holeNumber: number, data: any) => {
    setCurrentRound(prev => {
      if (!prev) return null;
      const newGameData = { ...prev.gameData };
      
      if (!newGameData[gameId]) {
        newGameData[gameId] = {};
      }
      
      newGameData[gameId] = {
        ...newGameData[gameId],
        [holeNumber]: data
      };

      return { ...prev, gameData: newGameData };
    });
  };

  const finishRound = () => {
    if (!currentRound) return;

    const completedRound = { ...currentRound, status: 'COMPLETE' as const };

    setRoundHistory(prev => {
      const index = prev.findIndex(r => r.id === currentRound.id);
      if (index !== -1) {
        const newHistory = [...prev];
        newHistory[index] = completedRound;
        return newHistory;
      }
      return [completedRound, ...prev];
    });

    setCurrentRound(null);
  };

  const loadPastRound = (round: Round) => {
    setCurrentRound(round);
  };

  const deleteRound = (roundId: string) => {
    setRoundHistory(prev => prev.filter(r => r.id !== roundId));
    if (currentRound?.id === roundId) {
      setCurrentRound(null);
    }
  };

  const saveCourse = (course: Course) => {
    setSavedCourses(prev => {
      const exists = prev.find(c => c.id === course.id);
      if (exists) {
        return prev.map(c => c.id === course.id ? course : c);
      }
      return [...prev, course];
    });
  };

  const deleteCourse = (courseId: string) => {
    setSavedCourses(prev => prev.filter(c => c.id !== courseId));
  };

  const value: AppState = {
    currentRound,
    savedCourses,
    roundHistory,
    startNewRound,
    updateScore,
    updateGameData,
    finishRound,
    loadPastRound,
    deleteRound,
    saveCourse,
    deleteCourse,
    roundTotals
  };

  return (
    <AppContext.Provider value={value}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/setup" element={<SetupWizard />} />
          <Route path="/active" element={<ActiveRound />} />
          <Route path="/scorecard" element={<Scorecard />} />
          <Route path="/summary" element={<RoundSummary />} />
          <Route path="/history" element={<RoundHistory />} />
        </Routes>
      </HashRouter>
    </AppContext.Provider>
  );
};

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
