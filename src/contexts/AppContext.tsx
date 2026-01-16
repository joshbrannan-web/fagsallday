import { createContext, useContext } from 'react';
import { Round, Player, Course, GameSettings } from '../types';

export interface AppState {
  currentRound: Round | null;
  savedCourses: Course[];
  favoriteCourses: Course[];
  nonFavoriteCourses: Course[];
  roundHistory: Round[];
  startNewRound: (course: Course, players: Player[], games: GameSettings[]) => void;
  updateScore: (holeNumber: number, playerId: string, score: number) => void;
  updateGameData: (gameId: string, holeNumber: number, key: string, value: any) => void;
  updateGameDataBatch: (gameId: string, holeNumber: number, updates: Record<string, any>) => void;
  finishRound: () => void;
  loadPastRound: (round: Round) => void;
  deleteRound: (roundId: string) => void;
  saveCourse: (course: Course) => void;
  updateCourse: (course: Course) => void;
  deleteCourse: (courseId: string) => void;
  toggleFavorite: (courseId: string) => void;
  isFavorite: (courseId: string) => boolean;
  roundTotals: { [playerId: string]: number };
  isLoading: boolean;
}

export const AppContext = createContext<AppState | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
