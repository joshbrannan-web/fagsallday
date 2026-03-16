import type { FC } from "react";
import { Player, GameSettings, GameType, GameLibraryItem } from "../types";
import { GAME_LIBRARY, GAME_DETAILS } from "@/lib/gameLibrary";
import { Info, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

interface GameSelectorProps {
  players: Player[];
  selectedGames: GameSettings[];
  onGamesChange: (games: GameSettings[]) => void;
  isTournamentMode?: boolean;
}

const GameSelector = ({ players, selectedGames, onGamesChange, isTournamentMode = false }: GameSelectorProps) => {
  const availableGames = isTournamentMode
    ? GAME_LIBRARY.filter(g => g.type !== GameType.SIXES && g.type !== GameType.STOCKTON_6)
    : GAME_LIBRARY;
  const handleToggleGame = (game: GameLibraryItem) => {
    const exists = selectedGames.find((g) => g.type === game.type);
    if (exists) {
      onGamesChange(selectedGames.filter((g) => g.type !== game.type));
    } else {
      if (players.length < game.minPlayers || players.length > game.maxPlayers) {
        toast.error(`${game.name} requires ${game.minPlayers}-${game.maxPlayers} players`);
        return;
      }
      const gameConfig = { ...game.config };
      if (game.type === GameType.FBO) {
        gameConfig.fboPlayers = players.map((p) => p.id);
      }
      // In tournament mode, force Team Banker to 18-hole mode
      if (isTournamentMode && game.type === GameType.TEAM_BANKER) {
        gameConfig.teamBanker = { ...gameConfig.teamBanker, mode: 'eighteen' };
      }
      onGamesChange([
        ...selectedGames,
        {
          id: `${game.type}-${Date.now()}`,
          type: game.type,
          name: game.name,
          unitStake: game.defaultUnitStake,
          config: gameConfig,
        },
      ]);
    }
  };

  const handleUpdateGameStake = (gameId: string, stake: number) => {
    onGamesChange(selectedGames.map((g) => (g.id === gameId ? { ...g, unitStake: stake } : g)));
  };

  const handleUpdateGameConfig = (gameId: string, configKey: string, value: boolean) => {
    onGamesChange(
      selectedGames.map((g) => (g.id === gameId ? { ...g, config: { ...g.config, [configKey]: value } } : g)),
    );
  };

  const updateGameConfigDeep = (gameId: string, updater: (g: GameSettings) => GameSettings) => {
    onGamesChange(selectedGames.map((g) => (g.id === gameId ? updater(g) : g)));
  };

  return (
    <div className="space-y-4">
      {availableGames.map((game) => {
        const isSelected = selectedGames.find((g) => g.type === game.type);
        const isDisabled = players.length < game.minPlayers || players.length > game.maxPlayers;
        const selectedGame = selectedGames.find((g) => g.type === game.type);

        return (
          <div key={game.type} className="space-y-3">
            <button
              onClick={() => !isDisabled && handleToggleGame(game)}
              disabled={isDisabled}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : isDisabled
                    ? "border-border bg-muted opacity-50 cursor-not-allowed"
                    : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{game.icon}</span>
                  <div>
                    <div className="font-semibold flex items-center gap-1.5">
                      {game.name}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 text-sm space-y-2" side="top">
                          <p className="font-semibold">{game.name}</p>
                          <p className="text-muted-foreground text-xs">{GAME_DETAILS[game.type]?.howItWorks}</p>
                          <div className="flex gap-4 text-xs">
                            <div><span className="font-medium">Players:</span> {GAME_DETAILS[game.type]?.idealPlayers}</div>
                          </div>
                          <div className="text-xs"><span className="font-medium">Example:</span> {GAME_DETAILS[game.type]?.examplePayout}</div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="text-sm text-muted-foreground">{game.description}</div>
                    {isDisabled && (
                      <div className="text-xs text-destructive mt-1">
                        Requires {game.minPlayers}-{game.maxPlayers} players
                      </div>
                    )}
                  </div>
                </div>
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected ? "bg-primary border-primary" : "border-border"
                  }`}
                >
                  {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                </div>
              </div>
            </button>

            {selectedGame && (
              <div className="ml-4 p-4 bg-muted rounded-xl space-y-3 animate-fade-in">
                {/* Stake controls */}
                {(game.type === GameType.FBO || game.type === GameType.SIXES) ? (
                  <div className="flex items-center justify-between">
                    <Label>Bet Amount (per segment)</Label>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => handleUpdateGameStake(selectedGame.id, Math.max(5, selectedGame.unitStake - 5))}
                        disabled={selectedGame.unitStake <= 5} className="h-8 px-2">-$5</Button>
                      <span className="w-14 text-center font-medium">${selectedGame.unitStake}</span>
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => handleUpdateGameStake(selectedGame.id, selectedGame.unitStake + 5)}
                        className="h-8 px-2">+$5</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <Label>Unit Stake</Label>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => handleUpdateGameStake(selectedGame.id, Math.max(1, selectedGame.unitStake - 1))}
                        disabled={selectedGame.unitStake <= 1} className="h-8 w-8 p-0">-$1</Button>
                      <span className="w-12 text-center font-medium">${selectedGame.unitStake}</span>
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => handleUpdateGameStake(selectedGame.id, selectedGame.unitStake + 1)}
                        className="h-8 w-8 p-0">+$1</Button>
                    </div>
                  </div>
                )}

                {/* FBO Player Selection */}
                {game.type === GameType.FBO && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Players in FBO</Label>
                      <div className="flex flex-wrap gap-2">
                        {players.map((player) => {
                          const fboPlayers = selectedGame.config.fboPlayers || [];
                          const isInGame = fboPlayers.includes(player.id);
                          return (
                            <button key={player.id} type="button"
                              onClick={() => {
                                const currentPlayers = selectedGame.config.fboPlayers || [];
                                const newPlayers = isInGame
                                  ? currentPlayers.filter((id: string) => id !== player.id)
                                  : [...currentPlayers, player.id];
                                updateGameConfigDeep(selectedGame.id, (g) => ({
                                  ...g, config: { ...g.config, fboPlayers: newPlayers }
                                }));
                              }}
                              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                isInGame
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-background border border-border text-muted-foreground hover:border-primary"
                              }`}
                            >
                              {player.name}
                            </button>
                          );
                        })}
                      </div>
                      {(selectedGame.config.fboPlayers?.length || 0) < 2 && (
                        <p className="text-xs text-destructive">Select at least 2 players</p>
                      )}
                    </div>

                    {/* FBO Allow Presses Toggle */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <div>
                        <Label className="text-sm font-medium">Allow Presses</Label>
                        <p className="text-xs text-muted-foreground">Double-or-nothing when dormie</p>
                      </div>
                      <Switch
                        checked={selectedGame.config.fbo?.allowPresses ?? false}
                        onCheckedChange={(checked) => {
                          updateGameConfigDeep(selectedGame.id, (g) => ({
                            ...g, config: { ...g.config, fbo: { ...g.config.fbo, allowPresses: checked } }
                          }));
                        }}
                      />
                    </div>

                    {/* FBO Game Mode Selection */}
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <Label className="text-sm font-medium">Game Mode</Label>
                      <RadioGroup
                        value={selectedGame.config.fbo?.gameMode || 'together'}
                        onValueChange={(value: 'together' | 'headToHead') => {
                          updateGameConfigDeep(selectedGame.id, (g) => ({
                            ...g, config: {
                              ...g.config, fbo: {
                                ...g.config.fbo, gameMode: value,
                                headToHeadMatchups: value === 'headToHead'
                                  ? (g.config.fbo?.headToHeadMatchups || []) : undefined
                              }
                            }
                          }));
                        }}
                        className="space-y-2"
                      >
                        <div className="flex items-start space-x-2 p-2 rounded-lg bg-background/50">
                          <RadioGroupItem value="together" id={`fbo-mode-together-${selectedGame.id}`} className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor={`fbo-mode-together-${selectedGame.id}`} className="font-medium cursor-pointer">All Together</Label>
                            <p className="text-xs text-muted-foreground">Everyone competes in one pool. Most dots wins each segment.</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2 p-2 rounded-lg bg-background/50">
                          <RadioGroupItem value="headToHead" id={`fbo-mode-h2h-${selectedGame.id}`} className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor={`fbo-mode-h2h-${selectedGame.id}`} className="font-medium cursor-pointer">Head to Head</Label>
                            <p className="text-xs text-muted-foreground">Create 1v1 matchups with separate stakes.</p>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Head-to-Head Matchup Builder */}
                    {selectedGame.config.fbo?.gameMode === 'headToHead' && (
                      <div className="space-y-2 animate-fade-in">
                        <Label className="text-sm font-medium">Matchups</Label>
                        <div className="space-y-2">
                          {(() => {
                            const fboPlayers = (selectedGame.config.fboPlayers || [])
                              .map((id: string) => players.find(p => p.id === id))
                              .filter(Boolean);
                            const matchups: Array<{ p1: Player; p2: Player }> = [];
                            for (let i = 0; i < fboPlayers.length; i++) {
                              for (let j = i + 1; j < fboPlayers.length; j++) {
                                matchups.push({ p1: fboPlayers[i]!, p2: fboPlayers[j]! });
                              }
                            }
                            if (matchups.length === 0) {
                              return <p className="text-xs text-muted-foreground">Select at least 2 players above to create matchups</p>;
                            }
                            const currentMatchups = selectedGame.config.fbo?.headToHeadMatchups || [];
                            return matchups.map(({ p1, p2 }) => {
                              const existingMatchup = currentMatchups.find(
                                (m: { player1Id: string; player2Id: string }) =>
                                  (m.player1Id === p1.id && m.player2Id === p2.id) ||
                                  (m.player1Id === p2.id && m.player2Id === p1.id)
                              );
                              const isEnabled = !!existingMatchup;
                              const unitValue = existingMatchup?.unitValue || selectedGame.unitStake;
                              return (
                                <div key={`${p1.id}-${p2.id}`}
                                  className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                                    isEnabled ? 'bg-primary/10 border border-primary/30' : 'bg-background/50 border border-border'
                                  }`}>
                                  <button type="button"
                                    onClick={() => {
                                      const newMatchups = isEnabled
                                        ? currentMatchups.filter(
                                            (m: { player1Id: string; player2Id: string }) =>
                                              !(m.player1Id === p1.id && m.player2Id === p2.id) &&
                                              !(m.player1Id === p2.id && m.player2Id === p1.id))
                                        : [...currentMatchups, { player1Id: p1.id, player2Id: p2.id, unitValue: selectedGame.unitStake }];
                                      updateGameConfigDeep(selectedGame.id, (g) => ({
                                        ...g, config: { ...g.config, fbo: { ...g.config.fbo, headToHeadMatchups: newMatchups } }
                                      }));
                                    }}
                                    className={`w-5 h-5 rounded border flex items-center justify-center ${
                                      isEnabled ? 'bg-primary border-primary' : 'border-muted-foreground'
                                    }`}>
                                    {isEnabled && <Check className="w-3 h-3 text-primary-foreground" />}
                                  </button>
                                  <span className="flex-1 text-sm font-medium">{p1.name} vs {p2.name}</span>
                                  {isEnabled && (
                                    <div className="flex items-center gap-1">
                                      <Button type="button" variant="outline" size="sm"
                                        onClick={() => {
                                          const newMatchups = currentMatchups.map(
                                            (m: { player1Id: string; player2Id: string; unitValue: number }) =>
                                              (m.player1Id === p1.id && m.player2Id === p2.id) ||
                                              (m.player1Id === p2.id && m.player2Id === p1.id)
                                                ? { ...m, unitValue: Math.max(1, m.unitValue - 1) } : m
                                          );
                                          updateGameConfigDeep(selectedGame.id, (g) => ({
                                            ...g, config: { ...g.config, fbo: { ...g.config.fbo, headToHeadMatchups: newMatchups } }
                                          }));
                                        }}
                                        className="h-6 w-6 p-0 text-xs">-</Button>
                                      <span className="w-10 text-center text-sm font-bold">${unitValue}</span>
                                      <Button type="button" variant="outline" size="sm"
                                        onClick={() => {
                                          const newMatchups = currentMatchups.map(
                                            (m: { player1Id: string; player2Id: string; unitValue: number }) =>
                                              (m.player1Id === p1.id && m.player2Id === p2.id) ||
                                              (m.player1Id === p2.id && m.player2Id === p1.id)
                                                ? { ...m, unitValue: m.unitValue + 1 } : m
                                          );
                                          updateGameConfigDeep(selectedGame.id, (g) => ({
                                            ...g, config: { ...g.config, fbo: { ...g.config.fbo, headToHeadMatchups: newMatchups } }
                                          }));
                                        }}
                                        className="h-6 w-6 p-0 text-xs">+</Button>
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>
                        {selectedGame.config.fbo?.gameMode === 'headToHead' &&
                         (selectedGame.config.fbo?.headToHeadMatchups?.length || 0) === 0 && (
                          <p className="text-xs text-destructive">Select at least one matchup</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Skins carryovers */}
                {game.type === GameType.SKINS && (
                  <div className="flex items-center justify-between">
                    <Label>Carryovers</Label>
                    <Switch
                      checked={selectedGame.config.carryovers ?? true}
                      onCheckedChange={(checked) => handleUpdateGameConfig(selectedGame.id, "carryovers", checked)}
                    />
                  </div>
                )}

                {/* Handicap Configuration - for all games except Stockton 6's */}
                {game.type !== GameType.STOCKTON_6 && (
                  <div className="space-y-4 pt-3 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Use Handicaps</Label>
                        <p className="text-xs text-muted-foreground">Apply strokes based on player handicaps</p>
                      </div>
                      <Switch
                        checked={selectedGame.config.useHandicaps ?? false}
                        onCheckedChange={(checked) => {
                          updateGameConfigDeep(selectedGame.id, (g) => ({
                            ...g, config: { ...g.config, useHandicaps: checked }
                          }));
                        }}
                      />
                    </div>

                    {selectedGame.config.useHandicaps && (
                      game.type === GameType.FBO ? (
                        <div className="space-y-2 animate-fade-in">
                          <Label className="text-sm font-medium">Handicap Mode</Label>
                          <RadioGroup
                            value={selectedGame.config.fbo?.handicapMode || 'absolute'}
                            onValueChange={(value: 'absolute' | 'relative') => {
                              updateGameConfigDeep(selectedGame.id, (g) => ({
                                ...g, config: { ...g.config, fbo: { ...g.config.fbo, handicapMode: value } }
                              }));
                            }}
                            className="space-y-2"
                          >
                            <div className="flex items-start space-x-2 p-2 rounded-lg bg-background/50">
                              <RadioGroupItem value="absolute" id={`fbo-handicap-absolute-${selectedGame.id}`} className="mt-1" />
                              <div className="flex-1">
                                <Label htmlFor={`fbo-handicap-absolute-${selectedGame.id}`} className="font-medium cursor-pointer">All Players Get Strokes</Label>
                                <p className="text-xs text-muted-foreground">Each player's strokes calculated independently. If all get a stroke, none do.</p>
                              </div>
                            </div>
                            <div className="flex items-start space-x-2 p-2 rounded-lg bg-background/50">
                              <RadioGroupItem value="relative" id={`fbo-handicap-relative-${selectedGame.id}`} className="mt-1" />
                              <div className="flex-1">
                                <Label htmlFor={`fbo-handicap-relative-${selectedGame.id}`} className="font-medium cursor-pointer">Lowest Handicap = 0</Label>
                                <p className="text-xs text-muted-foreground">Strokes based on differential from the lowest handicap player.</p>
                              </div>
                            </div>
                          </RadioGroup>
                        </div>
                      ) : (
                        <div className="space-y-2 animate-fade-in">
                          <Label className="text-sm font-medium">Handicap Mode</Label>
                          <RadioGroup
                            value={selectedGame.config.handicapMode || 'absolute'}
                            onValueChange={(value: 'absolute' | 'relative') => {
                              updateGameConfigDeep(selectedGame.id, (g) => ({
                                ...g, config: { ...g.config, handicapMode: value }
                              }));
                            }}
                            className="space-y-2"
                          >
                            <div className="flex items-start space-x-2 p-2 rounded-lg bg-background/50">
                              <RadioGroupItem value="absolute" id={`handicap-absolute-${selectedGame.id}`} className="mt-1" />
                              <div className="flex-1">
                                <Label htmlFor={`handicap-absolute-${selectedGame.id}`} className="font-medium cursor-pointer">All Players Get Strokes</Label>
                                <p className="text-xs text-muted-foreground">Each player's strokes calculated independently based on course handicap. If all players would get a stroke on a hole, no one does.</p>
                              </div>
                            </div>
                            <div className="flex items-start space-x-2 p-2 rounded-lg bg-background/50">
                              <RadioGroupItem value="relative" id={`handicap-relative-${selectedGame.id}`} className="mt-1" />
                              <div className="flex-1">
                                <Label htmlFor={`handicap-relative-${selectedGame.id}`} className="font-medium cursor-pointer">Lowest Handicap = 0</Label>
                                <p className="text-xs text-muted-foreground">Strokes based on handicap differential from the lowest handicap player (or banker in Banker games).</p>
                              </div>
                            </div>
                          </RadioGroup>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* Wolf Tee Order Configuration */}
                {game.type === GameType.WOLF && (
                  <div className="space-y-2 pt-3 border-t border-border/50">
                    <Label className="text-sm font-medium">Wolf Tees Off</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      {selectedGame.config.wolf?.teesFirst
                        ? "Wolf tees first, then picks partner after seeing opponent shots"
                        : "Others tee first, Wolf tees last after making partner decision"}
                    </p>
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={() => updateGameConfigDeep(selectedGame.id, (g) => ({
                          ...g, config: { ...g.config, wolf: { teesFirst: true } }
                        }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${
                          selectedGame.config.wolf?.teesFirst
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:border-primary"
                        }`}>First</button>
                      <button type="button"
                        onClick={() => updateGameConfigDeep(selectedGame.id, (g) => ({
                          ...g, config: { ...g.config, wolf: { teesFirst: false } }
                        }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${
                          !selectedGame.config.wolf?.teesFirst
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:border-primary"
                        }`}>Last</button>
                    </div>
                  </div>
                )}

                {/* Banker / Bloody Banker / Team Banker multipliers */}
                {(game.type === GameType.BANKER || game.type === GameType.BLOODY_BANKER || game.type === GameType.TEAM_BANKER) && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Birdie Multiplier</Label>
                      <RadioGroup
                        value={String(selectedGame.config.birdieMultiplier ?? 1)}
                        onValueChange={(value) => {
                          updateGameConfigDeep(selectedGame.id, (g) => ({
                            ...g, config: { ...g.config, birdieMultiplier: Number(value) }
                          }));
                        }}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="1" id={`birdie-none-${selectedGame.id}`} />
                          <Label htmlFor={`birdie-none-${selectedGame.id}`} className="font-normal cursor-pointer">None</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="2" id={`birdie-double-${selectedGame.id}`} />
                          <Label htmlFor={`birdie-double-${selectedGame.id}`} className="font-normal cursor-pointer">Double (2x)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="3" id={`birdie-triple-${selectedGame.id}`} />
                          <Label htmlFor={`birdie-triple-${selectedGame.id}`} className="font-normal cursor-pointer">Triple (3x)</Label>
                        </div>
                      </RadioGroup>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Eagle Multiplier</Label>
                      <RadioGroup
                        value={String(selectedGame.config.eagleMultiplier ?? 1)}
                        onValueChange={(value) => {
                          updateGameConfigDeep(selectedGame.id, (g) => ({
                            ...g, config: { ...g.config, eagleMultiplier: Number(value) }
                          }));
                        }}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="1" id={`eagle-none-${selectedGame.id}`} />
                          <Label htmlFor={`eagle-none-${selectedGame.id}`} className="font-normal cursor-pointer">None</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="3" id={`eagle-triple-${selectedGame.id}`} />
                          <Label htmlFor={`eagle-triple-${selectedGame.id}`} className="font-normal cursor-pointer">Triple (3x)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="5" id={`eagle-quintuple-${selectedGame.id}`} />
                          <Label htmlFor={`eagle-quintuple-${selectedGame.id}`} className="font-normal cursor-pointer">Quintuple (5x)</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Team Banker-specific: Rotation Mode + 2nd Ball Tiebreaker */}
                    {game.type === GameType.TEAM_BANKER && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Rotation Mode</Label>
                          <RadioGroup
                            value={selectedGame.config.teamBanker?.mode || 'sixes'}
                            onValueChange={(value: 'eighteen' | 'sixes' | 'threes') => {
                              updateGameConfigDeep(selectedGame.id, (g) => ({
                                ...g, config: { ...g.config, teamBanker: { ...g.config.teamBanker!, mode: value, useSecondBallTiebreaker: g.config.teamBanker?.useSecondBallTiebreaker ?? false } }
                              }));
                            }}
                            className="flex gap-3"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="eighteen" id={`tb-mode-18-${selectedGame.id}`} />
                              <Label htmlFor={`tb-mode-18-${selectedGame.id}`} className="font-normal cursor-pointer">18 Holes</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="sixes" id={`tb-mode-6-${selectedGame.id}`} />
                              <Label htmlFor={`tb-mode-6-${selectedGame.id}`} className="font-normal cursor-pointer">6's</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="threes" id={`tb-mode-3-${selectedGame.id}`} />
                              <Label htmlFor={`tb-mode-3-${selectedGame.id}`} className="font-normal cursor-pointer">3's</Label>
                            </div>
                          </RadioGroup>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <div>
                            <Label className="text-sm font-medium">2nd Ball Tiebreaker</Label>
                            <p className="text-xs text-muted-foreground">If 1st balls tie, compare 2nd balls</p>
                          </div>
                          <Switch
                            checked={selectedGame.config.teamBanker?.useSecondBallTiebreaker ?? false}
                            onCheckedChange={(checked) => {
                              updateGameConfigDeep(selectedGame.id, (g) => ({
                                ...g, config: { ...g.config, teamBanker: { ...g.config.teamBanker!, mode: g.config.teamBanker?.mode ?? 'sixes', useSecondBallTiebreaker: checked } }
                              }));
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default GameSelector;
