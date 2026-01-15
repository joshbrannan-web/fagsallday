import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../App";
import { Course, Player, GameSettings, GameType, Hole, GameLibraryItem } from "../types";
import { calculateCourseHandicap } from "../services/gameEngine";
import { searchCourse, courseDataToCourse } from "@/lib/api/courseSearch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSavedPlayers } from "@/hooks/useSavedPlayers";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  MapPin,
  Users,
  Trophy,
  Check,
  Search,
  Camera,
  Loader2,
  Globe,
  UserPlus,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Types for tee box data
interface TeeBox {
  name: string;
  color: string;
  rating?: number;
  slope?: number;
  holes: {
    number: number;
    yardage: number;
    par: number;
    handicapIndex: number;
  }[];
  totalYardage: number;
  totalPar: number;
}

// Game Library
const GAME_LIBRARY: GameLibraryItem[] = [
  {
    type: GameType.BANKER,
    name: "Banker",
    description: 'One player is "banker" each hole. Banker vs all other players with multipliers.',
    icon: "🏦",
    defaultUnitStake: 3,
    minPlayers: 3,
    maxPlayers: 8,
    config: { birdieMultiplier: 1, eagleMultiplier: 1 },
  },
  {
    type: GameType.BLOODY_BANKER,
    name: "Bloody Banker",
    description: 'One player is "banker" each hole. Banker vs all other players with multipliers.',
    icon: "🩸",
    defaultUnitStake: 3,
    minPlayers: 3,
    maxPlayers: 8,
    config: { birdieMultiplier: 1, eagleMultiplier: 1 },
  },
  {
    type: GameType.STOCKTON_6,
    name: "Stockton 6's",
    description: "2-player teams: 1-Ball & 2-Ball Nassau over 6-hole stretches with auto-presses and dots.",
    icon: "6️⃣",
    defaultUnitStake: 5,
    minPlayers: 4,
    maxPlayers: 4,
    config: { stockton6: { dotValue: 2 } },
  },
  {
    type: GameType.FBO,
    name: "FBO (Front/Back/Overall)",
    description: "Match play dots: 3 bets for Front 9, Back 9, and Overall 18.",
    icon: "🎱",
    defaultUnitStake: 10,
    minPlayers: 2,
    maxPlayers: 8,
    config: { fboPlayers: [] },
  },
  {
    type: GameType.SKINS,
    name: "Skins",
    description: "Lowest net score wins the skin. Ties carry over to next hole.",
    icon: "🎯",
    defaultUnitStake: 3,
    minPlayers: 2,
    maxPlayers: 8,
    config: { carryovers: true },
  },
  {
    type: GameType.NASSAU,
    name: "Nassau",
    description: "Three separate bets: Front 9, Back 9, and Overall (2 players only).",
    icon: "🏌️",
    defaultUnitStake: 3,
    minPlayers: 2,
    maxPlayers: 2,
    config: { presses: false },
  },
  {
    type: GameType.OPEN_BETTING,
    name: "Open Betting",
    description: "Manual side bets - track any wager between players.",
    icon: "💰",
    defaultUnitStake: 3,
    minPlayers: 2,
    maxPlayers: 8,
    config: {},
  },
];

// Default 18 holes
const createDefaultCourse = (name: string, location: string): Course => ({
  id: Date.now().toString(),
  name,
  location,
  holes: Array.from({ length: 18 }, (_, i) => ({
    number: i + 1,
    par: i < 9 ? [4, 5, 3, 4, 4, 3, 5, 4, 4][i % 9] : [4, 3, 5, 4, 4, 4, 3, 5, 4][i % 9],
    handicapIndex: (i % 18) + 1,
    yardage: 350 + (i % 5) * 50,
  })),
});

type CourseFinderMode = "select" | "location" | "search" | "camera" | "tee-select";

// Helper function to get tee color class
const getTeeColorClass = (color: string): string => {
  const colorMap: { [key: string]: string } = {
    black: "bg-black",
    blue: "bg-blue-600",
    white: "bg-white border border-gray-300",
    gold: "bg-yellow-500",
    yellow: "bg-yellow-500",
    red: "bg-red-600",
    green: "bg-green-600",
    silver: "bg-gray-400",
  };
  return colorMap[color.toLowerCase()] || "bg-gray-400";
};

const SetupWizard: React.FC = () => {
  const navigate = useNavigate();
  const { startNewRound, savedCourses, saveCourse } = useApp();
  const { user, profile } = useAuth();
  const { savedPlayers, addPlayer: addSavedPlayer } = useSavedPlayers();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [courseMode, setCourseMode] = useState<CourseFinderMode>("select");
  const [isLoading, setIsLoading] = useState(false);
  const [showSavedPlayers, setShowSavedPlayers] = useState(false);

  // Step 1: Course
  const [courseName, setCourseName] = useState("");
  const [courseLocation, setCourseLocation] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [editingHoles, setEditingHoles] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ name: string; url: string; description: string }>>([]);

  // Tee box selection (from scanned scorecard)
  const [availableTeeBoxes, setAvailableTeeBoxes] = useState<TeeBox[]>([]);
  const [selectedTeeBox, setSelectedTeeBox] = useState<string>("");

  // Step 2: Players
  const [players, setPlayers] = useState<Player[]>([
    { id: "1", name: "", handicapIndex: NaN, courseHandicap: 0, tee: "White" },
    { id: "2", name: "", handicapIndex: NaN, courseHandicap: 0, tee: "White" },
    { id: "3", name: "", handicapIndex: NaN, courseHandicap: 0, tee: "White" },
    { id: "4", name: "", handicapIndex: NaN, courseHandicap: 0, tee: "White" },
  ]);

  // Step 3: Games
  const [selectedGames, setSelectedGames] = useState<GameSettings[]>([]);

  // Pre-populate Player 1 with the signed-in user's profile
  React.useEffect(() => {
    if (profile && players[0] && !players[0].name.trim()) {
      const playerName = profile.display_name || user?.email?.split("@")[0] || "";
      const handicap = profile.handicap_index ?? NaN;
      setPlayers((prev) =>
        prev.map((p, i) =>
          i === 0
            ? {
                ...p,
                name: playerName,
                handicapIndex: handicap,
                courseHandicap: !isNaN(handicap) ? calculateCourseHandicap(handicap, 72) : 0,
              }
            : p,
        ),
      );
    }
  }, [profile, user]);

  const handleSelectSavedPlayerForSlot = (
    idx: number,
    savedPlayer: { id: string; name: string; handicap_index: number; tee: string },
  ) => {
    setPlayers(
      players.map((p, i) =>
        i === idx
          ? {
              ...p,
              name: savedPlayer.name,
              handicapIndex: savedPlayer.handicap_index,
              courseHandicap: calculateCourseHandicap(savedPlayer.handicap_index, 72),
              tee: savedPlayer.tee,
            }
          : p,
      ),
    );
  };

  const handleSelectSavedPlayer = (savedPlayer: { id: string; name: string; handicap_index: number; tee: string }) => {
    // Add to players list if not already at max
    if (players.filter((p) => p.name.trim()).length >= 8) {
      toast.error("Maximum 8 players allowed");
      return;
    }

    // Find first empty slot or add new
    const emptyIndex = players.findIndex((p) => !p.name.trim());
    if (emptyIndex !== -1) {
      setPlayers(
        players.map((p, i) =>
          i === emptyIndex
            ? {
                ...p,
                name: savedPlayer.name,
                handicapIndex: savedPlayer.handicap_index,
                courseHandicap: calculateCourseHandicap(savedPlayer.handicap_index, 72),
                tee: savedPlayer.tee,
              }
            : p,
        ),
      );
    } else {
      setPlayers([
        ...players,
        {
          id: Date.now().toString(),
          name: savedPlayer.name,
          handicapIndex: savedPlayer.handicap_index,
          courseHandicap: calculateCourseHandicap(savedPlayer.handicap_index, 72),
          tee: savedPlayer.tee,
        },
      ]);
    }
    setShowSavedPlayers(false);
    toast.success(`Added ${savedPlayer.name}`);
  };

  const handleSavePlayer = async (player: Player) => {
    if (!user) {
      toast.error("Sign in to save players");
      return;
    }
    if (!player.name.trim()) {
      toast.error("Enter player name first");
      return;
    }
    await addSavedPlayer(player.name, player.handicapIndex || 0, player.tee);
  };

  const handleUseLocation = () => {
    setIsLoading(true);
    setCourseMode("location");

    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      setIsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCourseLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        toast.success("Location found! Enter course name or search nearby courses.");
        setIsLoading(false);
      },
      (error) => {
        toast.error("Unable to get your location. Please try again or search manually.");
        setIsLoading(false);
        setCourseMode("select");
      },
      { timeout: 10000 },
    );
  };

  const handleSearchCourses = () => {
    setCourseMode("search");
    setSearchResults([]);
  };

  const handleFetchCourseData = async () => {
    if (!courseName.trim()) {
      toast.error("Please enter a course name");
      return;
    }

    setIsSearching(true);
    toast.info("Searching 18birdies.com for course data...");

    try {
      const result = await searchCourse(courseName, courseLocation);

      if (!result.success) {
        toast.error(result.error || "Failed to find course");
        setIsSearching(false);
        return;
      }

      if (result.course) {
        const course = courseDataToCourse(result.course);
        if (course) {
          setSelectedCourse(course);
          setHoles(course.holes);
          setCourseName(course.name);
          setCourseLocation(course.location);
          toast.success(`Found ${course.name}! Scorecard data loaded.`);
        }
      } else if (result.courses && result.courses.length > 0) {
        setSearchResults(result.courses);
        toast.info(`Found ${result.courses.length} possible matches`);
      } else {
        toast.warning("No course data found. Using default values.");
        const defaultCourse = createDefaultCourse(courseName, courseLocation);
        setSelectedCourse(defaultCourse);
        setHoles(defaultCourse.holes);
      }
    } catch (error) {
      console.error("Error fetching course:", error);
      toast.error("Failed to fetch course data");
    } finally {
      setIsSearching(false);
    }
  };

  const handleCameraUpload = () => {
    setCourseMode("camera");
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    toast.info("Analyzing scorecard with AI...");

    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix to get just base64
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const imageBase64 = await base64Promise;

      // Call the AI parsing edge function
      const { data, error } = await supabase.functions.invoke("parse-scorecard", {
        body: { imageBase64 },
      });

      if (error) {
        console.error("Error parsing scorecard:", error);
        toast.error("Failed to analyze scorecard. Please try again.");
        setIsLoading(false);
        return;
      }

      if (!data.success) {
        toast.error(data.error || "Failed to parse scorecard");
        setIsLoading(false);
        return;
      }

      const parsedData = data.data;

      // Store the parsed tee boxes
      setAvailableTeeBoxes(parsedData.teeBoxes);
      setCourseName(parsedData.courseName || "Scanned Course");
      setCourseLocation(parsedData.location || "");

      // If multiple tee boxes, go to tee selection mode
      if (parsedData.teeBoxes.length > 1) {
        setCourseMode("tee-select");
        toast.success(`Found ${parsedData.teeBoxes.length} tee boxes! Please select one.`);
      } else {
        // Only one tee box, use it directly
        const teeBox = parsedData.teeBoxes[0];
        handleSelectTeeBox(teeBox);
        toast.success("Course data extracted from scorecard!");
      }
    } catch (error) {
      console.error("Error processing scorecard:", error);
      toast.error("Failed to process scorecard image");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTeeBox = (teeBox: TeeBox) => {
    const course: Course = {
      id: Date.now().toString(),
      name: courseName || "Scanned Course",
      location: courseLocation || "",
      holes: teeBox.holes.map((h) => ({
        number: h.number,
        par: h.par,
        yardage: h.yardage,
        handicapIndex: h.handicapIndex,
      })),
    };

    setSelectedCourse(course);
    setHoles(course.holes);
    setSelectedTeeBox(teeBox.name);

    // Update players' tee selection
    setPlayers(players.map((p) => ({ ...p, tee: teeBox.name })));

    setCourseMode("search"); // Go to course details view
  };

  const handleAddPlayer = () => {
    if (players.length >= 8) return;
    setPlayers([
      ...players,
      {
        id: Date.now().toString(),
        name: "",
        handicapIndex: NaN,
        courseHandicap: 0,
        tee: "White",
      },
    ]);
  };

  const handleRemovePlayer = (id: string) => {
    if (players.length <= 1) return;
    setPlayers(players.filter((p) => p.id !== id));
  };

  const handlePlayerChange = (id: string, field: keyof Player, value: string | number) => {
    setPlayers(
      players.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, [field]: value };
        if (field === "handicapIndex") {
          updated.courseHandicap = calculateCourseHandicap(Number(value), 72);
        }
        return updated;
      }),
    );
  };

  const handleToggleGame = (game: GameLibraryItem) => {
    const exists = selectedGames.find((g) => g.type === game.type);
    if (exists) {
      setSelectedGames(selectedGames.filter((g) => g.type !== game.type));
    } else {
      if (players.length < game.minPlayers || players.length > game.maxPlayers) {
        toast.error(`${game.name} requires ${game.minPlayers}-${game.maxPlayers} players`);
        return;
      }

      // For FBO, auto-select all players
      const gameConfig = { ...game.config };
      if (game.type === GameType.FBO) {
        gameConfig.fboPlayers = players.filter((p) => p.name.trim()).map((p) => p.id);
      }

      setSelectedGames([
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
    setSelectedGames(selectedGames.map((g) => (g.id === gameId ? { ...g, unitStake: stake } : g)));
  };

  const handleUpdateGameConfig = (gameId: string, configKey: string, value: boolean) => {
    setSelectedGames(
      selectedGames.map((g) => (g.id === gameId ? { ...g, config: { ...g.config, [configKey]: value } } : g)),
    );
  };

  const handleCreateCourse = () => {
    if (!courseName.trim()) {
      toast.error("Please enter a course name");
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
    setHoles(holes.map((h) => (h.number === holeNumber ? { ...h, [field]: value } : h)));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!selectedCourse && !courseName.trim()) {
        toast.error("Please select or create a course");
        return;
      }
      if (!selectedCourse) {
        handleCreateCourse();
      }
      setStep(2);
    } else if (step === 2) {
      const validPlayers = players.filter((p) => p.name.trim());
      if (validPlayers.length < 2) {
        toast.error("Please add at least 2 players");
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
      toast.error("Please select at least one game");
      return;
    }

    const course: Course = selectedCourse || {
      id: Date.now().toString(),
      name: courseName,
      location: courseLocation,
      holes: holes.length ? holes : createDefaultCourse(courseName, courseLocation).holes,
    };

    saveCourse(course);

    const validPlayers = players
      .filter((p) => p.name.trim())
      .map((p) => ({
        ...p,
        courseHandicap: calculateCourseHandicap(p.handicapIndex, 72),
      }));

    startNewRound(course, validPlayers, selectedGames);
    toast.success("Round started!");
    navigate("/active");
  };

  const canProceed = () => {
    if (step === 1) return selectedCourse || courseName.trim();
    if (step === 2) return players.filter((p) => p.name.trim()).length >= 2;
    if (step === 3) return selectedGames.length > 0;
    return false;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hidden file input for camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="bg-card p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3 border-b border-border">
        <button
          onClick={() => {
            if (step === 1 && courseMode === "tee-select") {
              setCourseMode("camera");
              fileInputRef.current?.click();
            } else if (step === 1 && courseMode !== "select") {
              setCourseMode("select");
            } else if (step === 1) {
              navigate("/");
            } else {
              setStep((step - 1) as 1 | 2);
            }
          }}
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
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }} />
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Step 1: Course Selection */}
        {step === 1 && courseMode === "select" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Find Your Course</h2>
                <p className="text-sm text-muted-foreground">Choose how to set up your course</p>
              </div>
            </div>

            {/* Course Finding Options */}
            <div className="space-y-4">
              <button
                onClick={handleSearchCourses}
                className="w-full p-5 rounded-xl border-2 border-border bg-card hover:border-primary/50 transition-all text-left flex items-center gap-4 group"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Search className="w-7 h-7 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-lg">Search All Courses</div>
                  <div className="text-sm text-muted-foreground">Find any golf course by name</div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>

              <button
                onClick={handleCameraUpload}
                className="w-full p-5 rounded-xl border-2 border-border bg-card hover:border-primary/50 transition-all text-left flex items-center gap-4 group"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Camera className="w-7 h-7 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-lg">Scan Scorecard</div>
                  <div className="text-sm text-muted-foreground">Take a photo to auto-fill course data</div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            </div>

            {/* Saved Courses */}
            {savedCourses.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-border">
                <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Recently Played
                </Label>
                <div className="grid gap-3">
                  {savedCourses.slice(0, 3).map((course) => (
                    <button
                      key={course.id}
                      onClick={() => {
                        handleSelectSavedCourse(course);
                        setCourseMode("search");
                      }}
                      className="w-full p-4 rounded-xl border-2 border-border bg-card hover:border-primary/50 text-left transition-all"
                    >
                      <div className="font-semibold">{course.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {course.location || "No location"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Search Mode */}
        {step === 1 && courseMode === "search" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Search className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Course Details</h2>
                <p className="text-sm text-muted-foreground">Enter course information</p>
              </div>
            </div>

            <div className="space-y-4">
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
                <Label htmlFor="courseLocation">Location (optional)</Label>
                <Input
                  id="courseLocation"
                  value={courseLocation}
                  onChange={(e) => setCourseLocation(e.target.value)}
                  placeholder="e.g., Pine Valley, NJ"
                  className="mt-1"
                />
              </div>

              {/* Fetch from 18birdies button */}
              <Button
                onClick={handleFetchCourseData}
                disabled={isSearching || !courseName.trim()}
                className="w-full gap-2"
                variant="outline"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching 18birdies.com...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    Fetch Course Data from 18birdies
                  </>
                )}
              </Button>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Search Results</Label>
                  {searchResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setCourseName(result.name);
                        setSearchResults([]);
                        handleFetchCourseData();
                      }}
                      className="w-full p-3 rounded-lg border border-border bg-card hover:border-primary/50 text-left transition-all"
                    >
                      <div className="font-medium text-sm">{result.name}</div>
                      {result.description && (
                        <div className="text-xs text-muted-foreground truncate">{result.description}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Course Info */}
              {selectedCourse && (
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <Check className="w-4 h-4" />
                    Course data loaded!
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {selectedCourse.holes.length} holes • Par {selectedCourse.holes.reduce((sum, h) => sum + h.par, 0)}{" "}
                    • {selectedCourse.holes.reduce((sum, h) => sum + h.yardage, 0).toLocaleString()} yards
                  </div>
                </div>
              )}
            </div>

            {/* Edit Holes */}
            {courseName && (
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
                  {editingHoles ? "Hide Hole Details" : "Edit Hole Details"}
                </button>

                {editingHoles && holes.length > 0 && (
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="p-2 text-left">Hole</th>
                            <th className="p-2">Par</th>
                            <th className="p-2">HCP</th>
                            <th className="p-2">Yards</th>
                          </tr>
                        </thead>
                        <tbody>
                          {holes.map((hole) => (
                            <tr key={hole.number} className="border-t border-border">
                              <td className="p-2 font-medium">{hole.number}</td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  value={hole.par}
                                  onChange={(e) => handleUpdateHole(hole.number, "par", parseInt(e.target.value) || 4)}
                                  className="w-14 h-8 text-center"
                                  min={3}
                                  max={6}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  value={hole.handicapIndex}
                                  onChange={(e) =>
                                    handleUpdateHole(hole.number, "handicapIndex", parseInt(e.target.value) || 1)
                                  }
                                  className="w-14 h-8 text-center"
                                  min={1}
                                  max={18}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  value={hole.yardage}
                                  onChange={(e) =>
                                    handleUpdateHole(hole.number, "yardage", parseInt(e.target.value) || 300)
                                  }
                                  className="w-16 h-8 text-center"
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

        {/* Step 1: Camera Mode */}
        {step === 1 && courseMode === "camera" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Camera className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Scan Scorecard</h2>
                <p className="text-sm text-muted-foreground">Processing your scorecard...</p>
              </div>
            </div>

            {selectedCourse ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-success/10 border border-success/20">
                  <div className="flex items-center gap-2 text-success font-semibold">
                    <Check className="w-5 h-5" />
                    Course data extracted!
                  </div>
                </div>

                <div>
                  <Label htmlFor="courseName">Course Name</Label>
                  <Input
                    id="courseName"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">Analyzing scorecard image...</p>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Tee Box Selection Mode */}
        {step === 1 && courseMode === "tee-select" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Select Tee Box</h2>
                <p className="text-sm text-muted-foreground">Choose which tees you'll be playing from</p>
              </div>
            </div>

            {/* Course name preview */}
            <div className="p-4 rounded-xl bg-success/10 border border-success/20">
              <div className="flex items-center gap-2 text-success font-semibold">
                <Check className="w-5 h-5" />
                Course data extracted!
              </div>
              <p className="text-sm text-muted-foreground mt-1">{courseName}</p>
            </div>

            {/* Tee Box Options */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Available Tee Boxes</Label>
              {availableTeeBoxes.map((teeBox, idx) => {
                const teeColorClass = getTeeColorClass(teeBox.color);
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectTeeBox(teeBox)}
                    className="w-full p-4 rounded-xl border-2 border-border bg-card hover:border-primary/50 transition-all text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full ${teeColorClass}`} />
                        <div>
                          <div className="font-semibold">{teeBox.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {teeBox.totalYardage.toLocaleString()} yards • Par {teeBox.totalPar}
                            {teeBox.rating && teeBox.slope && (
                              <>
                                {" "}
                                • Rating {teeBox.rating}/{teeBox.slope}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Hole Details Preview */}
            {availableTeeBoxes.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-muted-foreground">Hole Data Preview (first tee box)</Label>
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="p-2 text-left">Hole</th>
                          <th className="p-2">Par</th>
                          <th className="p-2">HCP</th>
                          <th className="p-2">Yards</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availableTeeBoxes[0].holes.slice(0, 9).map((hole) => (
                          <tr key={hole.number} className="border-t border-border">
                            <td className="p-2 font-medium">{hole.number}</td>
                            <td className="p-2 text-center">{hole.par}</td>
                            <td className="p-2 text-center">{hole.handicapIndex}</td>
                            <td className="p-2 text-center">{hole.yardage}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

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
                <div key={player.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground">
                      Player {idx + 1} {idx === 0 && user && "(You)"}
                    </span>
                    {players.length > 1 && (
                      <button
                        onClick={() => handleRemovePlayer(player.id)}
                        className="p-1 text-destructive hover:bg-destructive/10 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Saved Players Selector for this slot */}
                  {user && savedPlayers.length > 0 && (
                    <Select
                      value=""
                      onValueChange={(value) => {
                        const sp = savedPlayers.find((p) => p.id === value);
                        if (sp) handleSelectSavedPlayerForSlot(idx, sp);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose from saved players..." />
                      </SelectTrigger>
                      <SelectContent>
                        {savedPlayers
                          .filter(
                            (sp) => !players.some((p) => p.name.trim().toLowerCase() === sp.name.trim().toLowerCase()),
                          )
                          .map((sp) => (
                            <SelectItem key={sp.id} value={sp.id}>
                              {sp.name} (HCP: {sp.handicap_index})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`name-${player.id}`}>Name</Label>
                      <Input
                        id={`name-${player.id}`}
                        value={player.name}
                        onChange={(e) => handlePlayerChange(player.id, "name", e.target.value)}
                        placeholder="Enter name manually"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`handicap-${player.id}`}>Handicap</Label>
                      <Input
                        id={`handicap-${player.id}`}
                        type="number"
                        value={isNaN(player.handicapIndex) ? "" : player.handicapIndex}
                        onChange={(e) =>
                          handlePlayerChange(
                            player.id,
                            "handicapIndex",
                            e.target.value === "" ? NaN : parseFloat(e.target.value),
                          )
                        }
                        placeholder="Enter handicap"
                        className="mt-1"
                        min={-10}
                        max={54}
                        step={0.1}
                      />
                    </div>
                  </div>
                  {!isNaN(player.handicapIndex) && player.handicapIndex > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Course Handicap: {calculateCourseHandicap(player.handicapIndex, 72)} strokes
                    </p>
                  )}
                </div>
              ))}

              {players.length < 8 && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleAddPlayer} className="flex-1">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Player
                  </Button>
                  {user && savedPlayers.length > 0 && (
                    <Dialog open={showSavedPlayers} onOpenChange={setShowSavedPlayers}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <UserPlus className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Saved Players</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {savedPlayers
                            .filter(
                              (sp) =>
                                !players.some((p) => p.name.trim().toLowerCase() === sp.name.trim().toLowerCase()),
                            )
                            .map((sp) => (
                              <button
                                key={sp.id}
                                onClick={() => handleSelectSavedPlayer(sp)}
                                className="w-full p-3 rounded-lg border border-border bg-card hover:border-primary/50 text-left transition-all"
                              >
                                <div className="font-medium">{sp.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  Handicap: {sp.handicap_index} • Tee: {sp.tee}
                                </div>
                              </button>
                            ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
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
              {GAME_LIBRARY.map((game) => {
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
                            <div className="font-semibold">{game.name}</div>
                            <div className="text-sm text-muted-foreground">{game.description}</div>
                            {isDisabled && (
                              <div className="text-xs text-destructive mt-1">
                                Requires {game.minPlayers}-{game.maxPlayers} players
                              </div>
                            )}
                          </div>
                        </div>
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? "bg-primary border-primary" : "border-border"
                          }`}
                        >
                          {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                        </div>
                      </div>
                    </button>

                    {selectedGame && (
                      <div className="ml-4 p-4 bg-muted rounded-xl space-y-3 animate-fade-in">
                        {/* FBO uses $5 increments, others use $1 */}
                        {game.type === GameType.FBO ? (
                          <div className="flex items-center justify-between">
                            <Label>Bet Amount (per segment)</Label>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleUpdateGameStake(selectedGame.id, Math.max(5, selectedGame.unitStake - 5))
                                }
                                disabled={selectedGame.unitStake <= 5}
                                className="h-8 px-2"
                              >
                                -$5
                              </Button>
                              <span className="w-14 text-center font-medium">${selectedGame.unitStake}</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleUpdateGameStake(selectedGame.id, selectedGame.unitStake + 5)}
                                className="h-8 px-2"
                              >
                                +$5
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <Label>Unit Stake</Label>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleUpdateGameStake(selectedGame.id, Math.max(1, selectedGame.unitStake - 1))
                                }
                                disabled={selectedGame.unitStake <= 1}
                                className="h-8 w-8 p-0"
                              >
                                -$1
                              </Button>
                              <span className="w-12 text-center font-medium">${selectedGame.unitStake}</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleUpdateGameStake(selectedGame.id, selectedGame.unitStake + 1)}
                                className="h-8 w-8 p-0"
                              >
                                +$1
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* FBO Player Selection */}
                        {game.type === GameType.FBO && (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Players in FBO</Label>
                            <div className="flex flex-wrap gap-2">
                              {players
                                .filter((p) => p.name.trim())
                                .map((player) => {
                                  const fboPlayers = selectedGame.config.fboPlayers || [];
                                  const isInGame = fboPlayers.includes(player.id);
                                  return (
                                    <button
                                      key={player.id}
                                      type="button"
                                      onClick={() => {
                                        const currentPlayers = selectedGame.config.fboPlayers || [];
                                        const newPlayers = isInGame
                                          ? currentPlayers.filter((id: string) => id !== player.id)
                                          : [...currentPlayers, player.id];
                                        setSelectedGames(
                                          selectedGames.map((g) =>
                                            g.id === selectedGame.id
                                              ? { ...g, config: { ...g.config, fboPlayers: newPlayers } }
                                              : g,
                                          ),
                                        );
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
                        )}

                        {game.type === GameType.SKINS && (
                          <div className="flex items-center justify-between">
                            <Label>Carryovers</Label>
                            <Switch
                              checked={selectedGame.config.carryovers ?? true}
                              onCheckedChange={(checked) =>
                                handleUpdateGameConfig(selectedGame.id, "carryovers", checked)
                              }
                            />
                          </div>
                        )}

                        {(game.type === GameType.BANKER || game.type === GameType.BLOODY_BANKER) && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Birdie Multiplier</Label>
                              <RadioGroup
                                value={String(selectedGame.config.birdieMultiplier ?? 1)}
                                onValueChange={(value) => {
                                  setSelectedGames(
                                    selectedGames.map((g) =>
                                      g.id === selectedGame.id
                                        ? { ...g, config: { ...g.config, birdieMultiplier: Number(value) } }
                                        : g,
                                    ),
                                  );
                                }}
                                className="flex gap-4"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="1" id={`birdie-none-${selectedGame.id}`} />
                                  <Label
                                    htmlFor={`birdie-none-${selectedGame.id}`}
                                    className="font-normal cursor-pointer"
                                  >
                                    None
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="3" id={`birdie-triple-${selectedGame.id}`} />
                                  <Label
                                    htmlFor={`birdie-triple-${selectedGame.id}`}
                                    className="font-normal cursor-pointer"
                                  >
                                    Triple (3x)
                                  </Label>
                                </div>
                              </RadioGroup>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Eagle Multiplier</Label>
                              <RadioGroup
                                value={String(selectedGame.config.eagleMultiplier ?? 1)}
                                onValueChange={(value) => {
                                  setSelectedGames(
                                    selectedGames.map((g) =>
                                      g.id === selectedGame.id
                                        ? { ...g, config: { ...g.config, eagleMultiplier: Number(value) } }
                                        : g,
                                    ),
                                  );
                                }}
                                className="flex gap-4"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="1" id={`eagle-none-${selectedGame.id}`} />
                                  <Label
                                    htmlFor={`eagle-none-${selectedGame.id}`}
                                    className="font-normal cursor-pointer"
                                  >
                                    None
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="3" id={`eagle-triple-${selectedGame.id}`} />
                                  <Label
                                    htmlFor={`eagle-triple-${selectedGame.id}`}
                                    className="font-normal cursor-pointer"
                                  >
                                    Triple (3x)
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="5" id={`eagle-quintuple-${selectedGame.id}`} />
                                  <Label
                                    htmlFor={`eagle-quintuple-${selectedGame.id}`}
                                    className="font-normal cursor-pointer"
                                  >
                                    Quintuple (5x)
                                  </Label>
                                </div>
                              </RadioGroup>
                            </div>
                          </div>
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
        <Button onClick={handleNext} disabled={!canProceed()} className="w-full h-12 text-lg font-bold">
          {step === 3 ? "Start Round" : "Continue"}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default SetupWizard;
