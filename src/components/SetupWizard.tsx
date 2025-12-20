import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import { Course, Player, GameSettings, GameType, Hole, GameLibraryItem } from '../types';
import { calculateCourseHandicap } from '../services/gameEngine';
import { ArrowLeft, ArrowRight, Plus, Trash2, MapPin, Users, Trophy, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

// Game Library
const GAME_LIBRARY: GameLibraryItem[] = [
  {
    type: GameType.BANKER,
    name: 'Banker',
    description: 'One player is "banker" each hole. Banker vs all other players with multipliers.',
    icon: '🏦',
    defaultUnitStake: 1,
    minPlayers: 3,
    maxPlayers: 8,
    config: { birdieTriple: true, eagleQuintuple: true }
  },
  {
    type: GameType.SKINS,
    name: 'Skins',
    description: 'Lowest net score wins the skin. Ties carry over to next hole.',
    icon: '🎯',
    defaultUnitStake: 5,
    minPlayers: 2,
    maxPlayers: 8,
    config: { carryovers: true }
  },
  {
    type: GameType.NASSAU,
    name: 'Nassau',
    description: 'Three separate bets: Front 9, Back 9, and Overall (2 players only).',
    icon: '🏌️',
    defaultUnitStake: 10,
    minPlayers: 2,
    maxPlayers: 2,
    config: { presses: false }
  },
  {
    type: GameType.OPEN_BETTING,
    name: 'Open Betting',
    description: 'Manual side bets - track any wager between players.',
    icon: '💰',
    defaultUnitStake: 1,
    minPlayers: 2,
    maxPlayers: 8,
    config: {}
  }
];

// Default 18 holes
const createDefaultCourse = (name: string, location: string): Course => ({
  id: Date.now().toString(),
  name,
  location,
  holes: Array.from({ length: 18 }, (_, i) => ({
    number: i + 1,
    par: i < 9 ? [4, 5, 3, 4, 4, 3, 5, 4, 4][i % 9] : [4, 3, 5, 4, 4, 4, 3, 5, 4][i % 9],
    handicapIndex: ((i % 18) + 1),
    yardage: 350 + (i % 5) * 50
  }))
});

const SetupWizard: React.FC = () => {
  const navigate = useNavigate();
  const { startNewRound, savedCourses, saveCourse } = useApp();
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  
  // Step 1: Course
  const [courseName, setCourseName] = useState('');
  const [courseLocation, setCourseLocation] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [editingHoles, setEditingHoles] = useState(false);
  
  // Step 2: Players
  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: '', handicapIndex: 0, courseHandicap: 0, tee: 'White' },
    { id: '2', name: '', handicapIndex: 0, courseHandicap: 0, tee: 'White' }
  ]);
  
  // Step 3: Games
  const [selectedGames, setSelectedGames] = useState<GameSettings[]>([]);

  const handleAddPlayer = () => {
    if (players.length >= 8) return;
    setPlayers([...players, {
      id: Date.now().toString(),
      name: '',
      handicapIndex: 0,
      courseHandicap: 0,
      tee: 'White'
    }]);
  };

  const handleRemovePlayer = (id: string) => {
    if (players.length <= 2) return;
    setPlayers(players.filter(p => p.id !== id));
  };

  const handlePlayerChange = (id: string, field: keyof Player, value: string | number) => {
    setPlayers(players.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, [field]: value };
      if (field === 'handicapIndex') {
        updated.courseHandicap = calculateCourseHandicap(Number(value), 72);
      }
      return updated;
    }));
  };

  const handleToggleGame = (game: GameLibraryItem) => {
    const exists = selectedGames.find(g => g.type === game.type);
    if (exists) {
      setSelectedGames(selectedGames.filter(g => g.type !== game.type));
    } else {
      // Check player count requirements
      if (players.length < game.minPlayers || players.length > game.maxPlayers) {
        toast.error(`${game.name} requires ${game.minPlayers}-${game.maxPlayers} players`);
        return;
      }
      
      setSelectedGames([...selectedGames, {
        id: `${game.type}-${Date.now()}`,
        type: game.type,
        name: game.name,
        unitStake: game.defaultUnitStake,
        config: { ...game.config }
      }]);
    }
  };

  const handleUpdateGameStake = (gameId: string, stake: number) => {
    setSelectedGames(selectedGames.map(g => 
      g.id === gameId ? { ...g, unitStake: stake } : g
    ));
  };

  const handleUpdateGameConfig = (gameId: string, configKey: string, value: boolean) => {
    setSelectedGames(selectedGames.map(g => 
      g.id === gameId ? { ...g, config: { ...g.config, [configKey]: value } } : g
    ));
  };

  const handleCreateCourse = () => {
    if (!courseName.trim()) {
      toast.error('Please enter a course name');
      return;
    }
    const course = createDefaultCourse(courseName, courseLocation);
    setSelectedCourse(course);
    setHoles(course.holes);
  };

  const handleSelectSavedCourse = (course: Course) => {
    setSelectedCourse(course);
    setCourseName(course.name);
    setCourseLocation(course.location);
    setHoles(course.holes);
  };

  const handleUpdateHole = (holeNumber: number, field: keyof Hole, value: number) => {
    setHoles(holes.map(h => 
      h.number === holeNumber ? { ...h, [field]: value } : h
    ));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!selectedCourse && !courseName.trim()) {
        toast.error('Please select or create a course');
        return;
      }
      if (!selectedCourse) {
        handleCreateCourse();
      }
      setStep(2);
    } else if (step === 2) {
      const validPlayers = players.filter(p => p.name.trim());
      if (validPlayers.length < 2) {
        toast.error('Please add at least 2 players');
        return;
      }
      setPlayers(validPlayers);
      setStep(3);
    } else {
      handleStartRound();
    }
  };

  const handleStartRound = () => {
    if (selectedGames.length === 0) {
      toast.error('Please select at least one game');
      return;
    }

    const course: Course = selectedCourse || {
      id: Date.now().toString(),
      name: courseName,
      location: courseLocation,
      holes: holes.length ? holes : createDefaultCourse(courseName, courseLocation).holes
    };

    // Save course for future use
    saveCourse(course);

    const validPlayers = players.filter(p => p.name.trim()).map(p => ({
      ...p,
      courseHandicap: calculateCourseHandicap(p.handicapIndex, 72)
    }));

    startNewRound(course, validPlayers, selectedGames);
    toast.success('Round started!');
    navigate('/active');
  };

  const canProceed = () => {
    if (step === 1) return selectedCourse || courseName.trim();
    if (step === 2) return players.filter(p => p.name.trim()).length >= 2;
    if (step === 3) return selectedGames.length > 0;
    return false;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3 border-b border-border">
        <button 
          onClick={() => step === 1 ? navigate('/') : setStep((step - 1) as 1 | 2)}
          className="p-2 hover:bg-muted rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">New Round</h1>
          <p className="text-sm text-muted-foreground">Step {step} of 3</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-muted">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Step 1: Course Selection */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Select Course</h2>
                <p className="text-sm text-muted-foreground">Choose or create a course</p>
              </div>
            </div>

            {/* Saved Courses */}
            {savedCourses.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Saved Courses
                </Label>
                <div className="grid gap-3">
                  {savedCourses.map(course => (
                    <button
                      key={course.id}
                      onClick={() => handleSelectSavedCourse(course)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        selectedCourse?.id === course.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      <div className="font-semibold">{course.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {course.location || 'No location'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Create New Course */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Or Create New
              </Label>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="courseName">Course Name</Label>
                  <Input
                    id="courseName"
                    value={courseName}
                    onChange={(e) => {
                      setCourseName(e.target.value);
                      setSelectedCourse(null);
                    }}
                    placeholder="e.g., Pine Valley Golf Club"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="courseLocation">Location</Label>
                  <Input
                    id="courseLocation"
                    value={courseLocation}
                    onChange={(e) => setCourseLocation(e.target.value)}
                    placeholder="e.g., Pine Valley, NJ"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Edit Holes (optional) */}
            {(selectedCourse || courseName) && (
              <div className="space-y-3">
                <button
                  onClick={() => {
                    if (!holes.length) {
                      setHoles(createDefaultCourse(courseName, courseLocation).holes);
                    }
                    setEditingHoles(!editingHoles);
                  }}
                  className="text-sm text-primary font-medium"
                >
                  {editingHoles ? 'Hide Hole Details' : 'Edit Hole Details'}
                </button>

                {editingHoles && holes.length > 0 && (
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="p-2 text-left">Hole</th>
                            <th className="p-2">Par</th>
                            <th className="p-2">Handicap</th>
                            <th className="p-2">Yardage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {holes.map(hole => (
                            <tr key={hole.number} className="border-t border-border">
                              <td className="p-2 font-medium">{hole.number}</td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  value={hole.par}
                                  onChange={(e) => handleUpdateHole(hole.number, 'par', parseInt(e.target.value) || 4)}
                                  className="w-16 h-8 text-center"
                                  min={3}
                                  max={6}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  value={hole.handicapIndex}
                                  onChange={(e) => handleUpdateHole(hole.number, 'handicapIndex', parseInt(e.target.value) || 1)}
                                  className="w-16 h-8 text-center"
                                  min={1}
                                  max={18}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  value={hole.yardage}
                                  onChange={(e) => handleUpdateHole(hole.number, 'yardage', parseInt(e.target.value) || 300)}
                                  className="w-20 h-8 text-center"
                                  min={50}
                                  max={700}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Players */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Add Players</h2>
                <p className="text-sm text-muted-foreground">Enter player names and handicaps</p>
              </div>
            </div>

            <div className="space-y-4">
              {players.map((player, idx) => (
                <div 
                  key={player.id}
                  className="bg-card rounded-xl border border-border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground">
                      Player {idx + 1}
                    </span>
                    {players.length > 2 && (
                      <button
                        onClick={() => handleRemovePlayer(player.id)}
                        className="p-1 text-destructive hover:bg-destructive/10 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`name-${player.id}`}>Name</Label>
                      <Input
                        id={`name-${player.id}`}
                        value={player.name}
                        onChange={(e) => handlePlayerChange(player.id, 'name', e.target.value)}
                        placeholder="Player name"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`handicap-${player.id}`}>Handicap</Label>
                      <Input
                        id={`handicap-${player.id}`}
                        type="number"
                        value={player.handicapIndex}
                        onChange={(e) => handlePlayerChange(player.id, 'handicapIndex', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="mt-1"
                        min={-10}
                        max={54}
                        step={0.1}
                      />
                    </div>
                  </div>
                  {player.handicapIndex > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Course Handicap: {calculateCourseHandicap(player.handicapIndex, 72)} strokes
                    </p>
                  )}
                </div>
              ))}

              {players.length < 8 && (
                <Button
                  variant="outline"
                  onClick={handleAddPlayer}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Player
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Games */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Select Games</h2>
                <p className="text-sm text-muted-foreground">Choose betting games to play</p>
              </div>
            </div>

            <div className="space-y-4">
              {GAME_LIBRARY.map(game => {
                const isSelected = selectedGames.find(g => g.type === game.type);
                const isDisabled = players.length < game.minPlayers || players.length > game.maxPlayers;
                const selectedGame = selectedGames.find(g => g.type === game.type);

                return (
                  <div key={game.type} className="space-y-3">
                    <button
                      onClick={() => !isDisabled && handleToggleGame(game)}
                      disabled={isDisabled}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : isDisabled
                          ? 'border-border bg-muted opacity-50 cursor-not-allowed'
                          : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{game.icon}</span>
                          <div>
                            <div className="font-semibold">{game.name}</div>
                            <div className="text-sm text-muted-foreground">{game.description}</div>
                            {isDisabled && (
                              <div className="text-xs text-destructive mt-1">
                                Requires {game.minPlayers}-{game.maxPlayers} players
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'bg-primary border-primary' : 'border-border'
                        }`}>
                          {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                        </div>
                      </div>
                    </button>

                    {/* Game Settings */}
                    {selectedGame && (
                      <div className="ml-4 p-4 bg-muted rounded-xl space-y-3 animate-fade-in">
                        <div className="flex items-center justify-between">
                          <Label>Unit Stake ($)</Label>
                          <Input
                            type="number"
                            value={selectedGame.unitStake}
                            onChange={(e) => handleUpdateGameStake(selectedGame.id, parseFloat(e.target.value) || 1)}
                            className="w-24 text-right"
                            min={1}
                            max={100}
                          />
                        </div>

                        {game.type === GameType.SKINS && (
                          <div className="flex items-center justify-between">
                            <Label>Carryovers</Label>
                            <Switch
                              checked={selectedGame.config.carryovers ?? true}
                              onCheckedChange={(checked) => handleUpdateGameConfig(selectedGame.id, 'carryovers', checked)}
                            />
                          </div>
                        )}

                        {game.type === GameType.BANKER && (
                          <>
                            <div className="flex items-center justify-between">
                              <Label>Birdie Triple (3x)</Label>
                              <Switch
                                checked={selectedGame.config.birdieTriple ?? true}
                                onCheckedChange={(checked) => handleUpdateGameConfig(selectedGame.id, 'birdieTriple', checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label>Eagle Quintuple (5x)</Label>
                              <Switch
                                checked={selectedGame.config.eagleQuintuple ?? true}
                                onCheckedChange={(checked) => handleUpdateGameConfig(selectedGame.id, 'eagleQuintuple', checked)}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-card border-t border-border">
        <Button
          onClick={handleNext}
          disabled={!canProceed()}
          className="w-full h-12 text-lg font-bold"
        >
          {step === 3 ? 'Start Round' : 'Continue'}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default SetupWizard;
