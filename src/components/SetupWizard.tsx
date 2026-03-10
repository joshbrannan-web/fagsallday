import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../contexts/AppContext";
import { Course, Player, GameSettings, GameType, Hole, GameLibraryItem } from "../types";
import { GAME_LIBRARY, GAME_DETAILS } from "@/lib/gameLibrary";
import { calculateCourseHandicap } from "../services/gameEngine";
import { searchCourse, fetchCourseDetails, courseDataToCourse } from "@/lib/api/courseSearch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSavedPlayers } from "@/hooks/useSavedPlayers";
import { useVerifiedCourses, VerifiedCourseResult } from "@/hooks/useVerifiedCourses";
import TeamSetupStep from "./TeamSetupStep";
import GameSelector from "./GameSelector";
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
  Star,
  Calendar,
  ShieldCheck,
  BadgeCheck,
  Info,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import UserSearchDialog from "@/components/UserSearchDialog";

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

// GAME_LIBRARY and GAME_DETAILS are now imported from @/lib/gameLibrary

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
  const location = useLocation();
  const locationState = location.state as { changeGamesMode?: boolean; existingCourse?: Course; existingPlayers?: Player[] } | null;
  const changeGamesMode = locationState?.changeGamesMode || false;
  const { startNewRound, changeGames, savedCourses, favoriteCourses, nonFavoriteCourses, saveCourse, updateCourse, deleteCourse, toggleFavorite, isFavorite, roundHistory, deleteRound } = useApp();
  const { user, profile } = useAuth();
  const { savedPlayers, addPlayer: addSavedPlayer } = useSavedPlayers();
  const { searchVerifiedCourses, verifyCourse, checkIfVerified, isVerifying } = useVerifiedCourses();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(changeGamesMode ? 3 : 1);
  const [courseMode, setCourseMode] = useState<CourseFinderMode>("select");
  const [isLoading, setIsLoading] = useState(false);
  const [showSavedPlayers, setShowSavedPlayers] = useState(false);
   const [showUserSearch, setShowUserSearch] = useState(false);
   const [userSearchSlotIndex, setUserSearchSlotIndex] = useState<number | null>(null);

  // Step 1: Course
  const [courseName, setCourseName] = useState("");
  const [courseLocation, setCourseLocation] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(locationState?.existingCourse || null);
  const [holes, setHoles] = useState<Hole[]>(locationState?.existingCourse?.holes || []);
  const [editingHoles, setEditingHoles] = useState(false);
  const [holesModified, setHolesModified] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ name: string; location: string; url: string }>>([]);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [verifiedResults, setVerifiedResults] = useState<VerifiedCourseResult[]>([]);
  const [verifiedCourseNames, setVerifiedCourseNames] = useState<Set<string>>(new Set());
  const [courseSaved, setCourseSaved] = useState(false);

  // Tee box selection (from scanned scorecard)
  const [availableTeeBoxes, setAvailableTeeBoxes] = useState<TeeBox[]>([]);
  const [selectedTeeBox, setSelectedTeeBox] = useState<string>("");

  // Step 2: Players
  const [players, setPlayers] = useState<Player[]>(
    locationState?.existingPlayers || [
      { id: "1", name: "", handicapIndex: NaN, courseHandicap: 0, tee: "White" },
      { id: "2", name: "", handicapIndex: NaN, courseHandicap: 0, tee: "White" },
      { id: "3", name: "", handicapIndex: NaN, courseHandicap: 0, tee: "White" },
      { id: "4", name: "", handicapIndex: NaN, courseHandicap: 0, tee: "White" },
    ]
  );

  // Step 3: Games
  const [selectedGames, setSelectedGames] = useState<GameSettings[]>([]);

  // Load verified status for saved courses
  useEffect(() => {
    const loadVerifiedNames = async () => {
      const allCourseNames = [...favoriteCourses, ...nonFavoriteCourses].map(c => c.name);
      if (allCourseNames.length === 0) return;
      
      const verified = new Set<string>();
      for (const name of allCourseNames) {
        const isV = await checkIfVerified(name);
        if (isV) verified.add(name.toLowerCase());
      }
      setVerifiedCourseNames(verified);
    };
    loadVerifiedNames();
  }, [favoriteCourses, nonFavoriteCourses, checkIfVerified]);

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

      // Auto-sync GHIN if linked and last sync > 24 hours ago
      if (profile.ghin_number && user) {
        const lastSynced = profile.ghin_last_synced ? new Date(profile.ghin_last_synced).getTime() : 0;
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        if (lastSynced < oneDayAgo) {
          supabase.functions.invoke('sync-ghin-handicap', {
            body: { ghin_number: profile.ghin_number, update_profile: true },
          }).then(({ data, error }) => {
            if (!error && data && !data.error && typeof data.handicap_index === 'number') {
              setPlayers((prev) =>
                prev.map((p, i) =>
                  i === 0
                    ? {
                        ...p,
                        handicapIndex: data.handicap_index,
                        courseHandicap: calculateCourseHandicap(data.handicap_index, 72),
                      }
                    : p,
                ),
              );
            }
          }).catch(() => {});
        }
      }
    }
  }, [profile, user]);

  const handleSelectSavedPlayerForSlot = (
    idx: number,
    savedPlayer: { id: string; name: string; handicap_index: number; tee: string; linked_user_id?: string | null },
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
              linkedUserId: savedPlayer.linked_user_id || undefined,
            }
          : p,
      ),
    );
  };

  const handleSelectSavedPlayer = (savedPlayer: { id: string; name: string; handicap_index: number; tee: string; linked_user_id?: string | null }) => {
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
                linkedUserId: savedPlayer.linked_user_id || undefined,
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
          linkedUserId: savedPlayer.linked_user_id || undefined,
        },
      ]);
    }
    setShowSavedPlayers(false);
    toast.success(`Added ${savedPlayer.name}`);
  };

  const handleAppUserSelected = async (selectedUser: { id: string; display_name: string; handicap_index?: number }) => {
    const handicap = selectedUser.handicap_index ?? 0;
    // Add to saved players as a linked player with their actual handicap
    await addSavedPlayer(selectedUser.display_name, handicap, 'White', selectedUser.id);

    const totalPar = selectedCourse?.holes?.reduce((s, h) => s + h.par, 0) || 72;
    const newPlayer: Player = {
      id: Date.now().toString(),
      name: selectedUser.display_name,
      handicapIndex: handicap,
      courseHandicap: handicap ? calculateCourseHandicap(handicap, totalPar) : 0,
      tee: 'White',
      linkedUserId: selectedUser.id,
    };

    if (userSearchSlotIndex !== null) {
      // Fill the specific slot that triggered the search
      setPlayers(players.map((p, i) => (i === userSearchSlotIndex ? { ...newPlayer, id: p.id } : p)));
      setUserSearchSlotIndex(null);
    } else {
      // Find first empty slot or append
      const emptyIndex = players.findIndex((p) => !p.name.trim());
      if (emptyIndex !== -1) {
        setPlayers(players.map((p, i) => (i === emptyIndex ? { ...newPlayer, id: p.id } : p)));
      } else if (players.length < 8) {
        setPlayers([...players, newPlayer]);
      } else {
        toast.error('Maximum 8 players allowed');
        return;
      }
    }
    toast.success(`Added ${selectedUser.display_name}`);
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

  const handleSelectVerifiedCourse = (result: VerifiedCourseResult) => {
    const courseData = result.course_data;
    const course: Course = {
      id: crypto.randomUUID(),
      name: courseData.name || result.course_name,
      location: courseData.location || result.course_location,
      holes: courseData.holes || [],
    };
    setSelectedCourse(course);
    setHoles(course.holes);
    setCourseName(course.name);
    setCourseLocation(course.location);
    toast.success(`Loaded ${course.name} from verified library!`);
  };

  const handleVerifyCourse = async (course: Course) => {
    const success = await verifyCourse(course);
    if (success) {
      setVerifiedCourseNames(prev => new Set([...prev, course.name.toLowerCase()]));
    }
  };

  const handleFetchCourseData = async () => {
    if (!courseName.trim()) {
      toast.error("Please enter a course name");
      return;
    }

    setIsSearching(true);
    setVerifiedResults([]);

    // Search verified library first (instant)
    const verifiedMatches = await searchVerifiedCourses(courseName);
    setVerifiedResults(verifiedMatches);

    if (verifiedMatches.length > 0) {
      toast.info(`Found ${verifiedMatches.length} verified course${verifiedMatches.length > 1 ? 's' : ''}!`);
    } else {
      toast.info("Searching course database...");
    }

    try {
      const result = await searchCourse(courseName, courseLocation);

      if (!result.success) {
        if (verifiedMatches.length === 0) {
          toast.error(result.error || "Failed to find course");
        }
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
        if (verifiedMatches.length === 0) {
          toast.info(`Found ${result.courses.length} possible matches`);
        }
      } else if (verifiedMatches.length === 0) {
        toast.warning("No course data found. Using default values.");
        const defaultCourse = createDefaultCourse(courseName, courseLocation);
        setSelectedCourse(defaultCourse);
        setHoles(defaultCourse.holes);
      }
    } catch (error) {
      console.error("Error fetching course:", error);
      if (verifiedMatches.length === 0) {
        toast.error("Failed to fetch course data");
      }
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

    // Auto-verify scanned courses to the community library
    if (user) {
      verifyCourse(course).then(success => {
        if (success) {
          setVerifiedCourseNames(prev => new Set([...prev, course.name.toLowerCase()]));
        }
      });
    }
  };

  const handleSaveScannedCourse = async () => {
    if (!selectedCourse && availableTeeBoxes.length === 0) {
      toast.error("No course data to save");
      return;
    }

    // If course already selected, save it
    if (selectedCourse) {
      await saveCourse(selectedCourse);
      toast.success("Course saved!");
      return;
    }

    // If we have tee boxes but no selection yet, use first one
    const teeBox = availableTeeBoxes[0];
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

    await saveCourse(course);
    setSelectedCourse(course);
    toast.success("Course saved!");

    // Auto-verify saved scanned courses to the community library
    if (user) {
      verifyCourse(course).then(success => {
        if (success) {
          setVerifiedCourseNames(prev => new Set([...prev, course.name.toLowerCase()]));
        }
      });
    }
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

  // Game selection handlers removed — now delegated to <GameSelector />

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
    setHolesModified(true);
  };

  const handleSaveHoleChanges = async () => {
    if (!selectedCourse || !holesModified) return;
    
    const updatedCourse: Course = {
      ...selectedCourse,
      holes: holes,
    };
    
    await updateCourse(updatedCourse);
    setSelectedCourse(updatedCourse);
    setHolesModified(false);
  };

  const formatRoundDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Check if any selected game requires team setup
  const hasTeamGame = selectedGames.some(
    g => g.type === GameType.SIXES || g.type === GameType.STOCKTON_6 || g.type === GameType.TEAM_BANKER
  );

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
    } else if (step === 3) {
      if (hasTeamGame) {
        setStep(4);
      } else {
        handleStartRound();
      }
    }
  };

  const handleStartRound = (initialGameData?: Record<string, any>) => {
    if (selectedGames.length === 0) {
      toast.error("Please select at least one game");
      return;
    }

    if (changeGamesMode) {
      changeGames(selectedGames, initialGameData);
      toast.success("Games updated! Starting fresh from hole 1.");
      navigate("/active");
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

    startNewRound(course, validPlayers, selectedGames, initialGameData);
    toast.success("Round started!");
    navigate("/active");
  };

  const canProceed = () => {
    if (step === 1) return selectedCourse || courseName.trim();
    if (step === 2) return players.filter((p) => p.name.trim()).length >= 2;
    if (step === 3) return selectedGames.length > 0;
    // Step 4 is handled by TeamSetupStep component
    return false;
  };

  // Calculate total steps (4 if team games, 3 otherwise)
  const totalSteps = hasTeamGame ? 4 : 3;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hidden file input for camera/photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="bg-card p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3 border-b border-border">
        <button
          onClick={() => {
            if (changeGamesMode && step === 3) {
              navigate('/summary');
            } else if (step === 1 && courseMode === "tee-select") {
              setCourseMode("camera");
              fileInputRef.current?.click();
            } else if (step === 1 && courseMode !== "select") {
              setCourseMode("select");
            } else if (step === 1) {
              navigate("/");
            } else if (step === 4) {
              setStep(3);
            } else {
              setStep((step - 1) as 1 | 2 | 3);
            }
          }}
          className="p-2 hover:bg-muted rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">New Round</h1>
          <p className="text-sm text-muted-foreground">Step {step} of {totalSteps}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-muted">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(step / totalSteps) * 100}%` }} />
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
                  <div className="text-sm text-muted-foreground">Take or upload a photo to auto-fill course data</div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            </div>

            {/* Favorites (saved courses + favorite rounds) */}
            {(() => {
              const favoriteRounds = roundHistory.filter(r => r.isFavorite);
              const favCourseNames = new Set(favoriteCourses.map(c => c.name.toLowerCase()));
              const dedupedFavoriteRounds = favoriteRounds.filter(r => !favCourseNames.has(r.course.name.toLowerCase()));
              const hasFavorites = favoriteCourses.length > 0 || dedupedFavoriteRounds.length > 0;

              return hasFavorites ? (
                <div className="space-y-3 pt-4 border-t border-border">
                  <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    Favorites
                  </Label>
                  <div className="grid gap-3">
                    {favoriteCourses.map((course) => (
                      <div
                        key={course.id}
                        className="w-full p-4 rounded-xl border-2 border-border bg-card hover:border-primary/50 text-left transition-all flex items-center gap-3"
                      >
                        <button
                          onClick={() => {
                            handleSelectSavedCourse(course);
                            setCourseMode("search");
                          }}
                          className="flex-1 text-left"
                        >
                          <div className="font-semibold flex items-center gap-2">
                            {course.name}
                            {verifiedCourseNames.has(course.name.toLowerCase()) && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                                <BadgeCheck className="w-3 h-3" /> Verified
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {course.location || "No location"}
                          </div>
                        </button>
                        {!verifiedCourseNames.has(course.name.toLowerCase()) && user && (
                          <button
                            onClick={() => handleVerifyCourse(course)}
                            disabled={isVerifying}
                            className="p-2 hover:bg-primary/10 rounded-full transition-colors text-muted-foreground hover:text-primary"
                            title="Verify and share with community"
                          >
                            <ShieldCheck className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => toggleFavorite(course.id)}
                          className="p-2 hover:bg-muted rounded-full transition-colors"
                        >
                          <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                        </button>
                      </div>
                    ))}
                    {dedupedFavoriteRounds.map((round) => (
                      <div
                        key={`fav-round-${round.id}`}
                        className="w-full p-4 rounded-xl border-2 border-border bg-card hover:border-primary/50 text-left transition-all flex items-center gap-3"
                      >
                        <button
                          onClick={() => {
                            handleSelectSavedCourse(round.course);
                            setCourseMode("search");
                          }}
                          className="flex-1 text-left"
                        >
                          <div className="font-semibold flex items-center gap-2">
                            {round.course.name}
                            {verifiedCourseNames.has(round.course.name.toLowerCase()) && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                                <BadgeCheck className="w-3 h-3" /> Verified
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(round.startTime).toLocaleDateString()} · {round.players.length} player{round.players.length !== 1 ? 's' : ''}
                            <span className="ml-1 text-xs italic text-muted-foreground/70">from round</span>
                          </div>
                        </button>
                        {!verifiedCourseNames.has(round.course.name.toLowerCase()) && user && (
                          <button
                            onClick={() => handleVerifyCourse(round.course)}
                            disabled={isVerifying}
                            className="p-2 hover:bg-primary/10 rounded-full transition-colors text-muted-foreground hover:text-primary"
                            title="Verify and share with community"
                          >
                            <ShieldCheck className="w-5 h-5" />
                          </button>
                        )}
                        <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Recently Played Courses */}
            {nonFavoriteCourses.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-border">
                <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Recently Played
                </Label>
                <div className="grid gap-3">
                  {nonFavoriteCourses.slice(0, 3).map((course) => (
                    <div
                      key={course.id}
                      className="w-full p-4 rounded-xl border-2 border-border bg-card hover:border-primary/50 text-left transition-all flex items-center gap-3"
                    >
                      <button
                        onClick={() => {
                          handleSelectSavedCourse(course);
                          setCourseMode("search");
                        }}
                        className="flex-1 text-left"
                      >
                        <div className="font-semibold flex items-center gap-2">
                          {course.name}
                          {verifiedCourseNames.has(course.name.toLowerCase()) && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                              <BadgeCheck className="w-3 h-3" /> Verified
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {course.location || "No location"}
                        </div>
                      </button>
                      {!verifiedCourseNames.has(course.name.toLowerCase()) && user && (
                        <button
                          onClick={() => handleVerifyCourse(course)}
                          disabled={isVerifying}
                          className="p-2 hover:bg-primary/10 rounded-full transition-colors text-muted-foreground hover:text-primary"
                          title="Verify and share with community"
                        >
                          <ShieldCheck className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => toggleFavorite(course.id)}
                        className="p-2 hover:bg-muted rounded-full transition-colors"
                      >
                        <Star className="w-5 h-5 text-muted-foreground hover:text-yellow-400" />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="p-2 hover:bg-destructive/10 rounded-full transition-colors">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Course?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove {course.name} from your saved courses. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteCourse(course.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Rounds */}
            {roundHistory.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-border">
                <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Recent Rounds
                </Label>
                <div className="grid gap-3">
                  {roundHistory.slice(0, 3).map((round) => (
                    <div
                      key={round.id}
                      className="w-full p-4 rounded-xl border-2 border-border bg-card text-left transition-all flex items-center gap-3"
                    >
                      <div className="flex-1">
                        <div className="font-semibold">{round.course.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <span>{formatRoundDate(round.startTime)}</span>
                          <span>•</span>
                          <span>{round.players.length} players</span>
                          <span>•</span>
                          <span className={
                            round.status === 'LOCKED' ? 'text-blue-600' :
                            round.status === 'COMPLETE' ? 'text-green-600' :
                            round.status === 'ACTIVE' ? 'text-yellow-600' :
                            'text-muted-foreground'
                          }>
                            {round.status === 'LOCKED' ? 'Locked' :
                             round.status === 'COMPLETE' ? 'Complete' :
                             round.status === 'ACTIVE' ? 'Active' :
                             round.status}
                          </span>
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="p-2 hover:bg-destructive/10 rounded-full transition-colors">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Round?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the round at {round.course.name} from {formatRoundDate(round.startTime)}. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteRound(round.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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

              {/* Search Course Database button */}
              <Button
                onClick={handleFetchCourseData}
                disabled={isSearching || !courseName.trim()}
                className="w-full gap-2"
                variant="outline"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching course database...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    Search Course Database
                  </>
                )}
              </Button>

              {/* Verified Course Results */}
              {verifiedResults.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <BadgeCheck className="w-4 h-4 text-primary" />
                    Verified by community ({verifiedResults.length})
                  </Label>
                  {verifiedResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleSelectVerifiedCourse(result)}
                      className="w-full p-3 rounded-lg border-2 border-primary/30 bg-primary/5 hover:border-primary/60 text-left transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <BadgeCheck className="w-4 h-4 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{result.course_name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {result.course_location || "No location"} · Par {result.total_par} · {result.total_yardage.toLocaleString()} yards
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* External Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {verifiedResults.length > 0 && (
                    <div className="border-t border-border pt-3" />
                  )}
                  <Label className="text-sm text-muted-foreground">
                    <Globe className="w-3.5 h-3.5 inline mr-1" />
                    External results ({searchResults.length} found)
                  </Label>
                  {searchResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={async () => {
                        setIsFetchingDetails(true);
                        setSearchResults([]);
                        toast.info(`Fetching scorecard for ${result.name}...`);
                        
                        const detailsResult = await fetchCourseDetails(result.url, result.name);
                        
                        if (detailsResult.success && detailsResult.course) {
                          const course = courseDataToCourse(detailsResult.course);
                          if (course) {
                            setSelectedCourse(course);
                            setHoles(course.holes);
                            setCourseName(course.name);
                            setCourseLocation(course.location);
                            toast.success(`Loaded ${course.name} scorecard!`);
                          }
                        } else {
                          toast.error(detailsResult.error || "Failed to fetch course details");
                        }
                        setIsFetchingDetails(false);
                      }}
                      disabled={isFetchingDetails}
                      className="w-full p-3 rounded-lg border border-border bg-card hover:border-primary/50 text-left transition-all disabled:opacity-50"
                    >
                      <div className="font-medium text-sm">{result.name}</div>
                      {result.location && (
                        <div className="text-xs text-muted-foreground truncate">{result.location}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              
              {isFetchingDetails && (
                <div className="flex items-center justify-center gap-2 p-4 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading scorecard data...</span>
                </div>
              )}

              {/* Selected Course Info */}
              {selectedCourse && (
                <>
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

                  {/* Save & Verify action buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={courseSaved}
                      onClick={async () => {
                        const updatedCourse: Course = {
                          ...selectedCourse,
                          name: courseName || selectedCourse.name,
                          location: courseLocation || selectedCourse.location,
                        };
                        await saveCourse(updatedCourse);
                        setCourseSaved(true);
                        toast.success("Course saved for later!");
                      }}
                      className="flex-1"
                    >
                      {courseSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                      {courseSaved ? "Saved" : "Save for Later"}
                    </Button>

                    {user && !verifiedCourseNames.has((courseName || selectedCourse.name).toLowerCase()) && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isVerifying}
                        onClick={async () => {
                          const updatedCourse: Course = {
                            ...selectedCourse,
                            name: courseName || selectedCourse.name,
                            location: courseLocation || selectedCourse.location,
                          };
                          await handleVerifyCourse(updatedCourse);
                        }}
                        className="flex-1"
                      >
                        {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        Verify for Community
                      </Button>
                    )}
                  </div>
                </>
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
                    {holesModified && selectedCourse && (
                      <div className="p-3 border-t border-border">
                        <Button
                          onClick={handleSaveHoleChanges}
                          className="w-full gap-2"
                          size="sm"
                        >
                          <Save className="w-4 h-4" />
                          Save Hole Changes
                        </Button>
                      </div>
                    )}
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

                <Button
                  variant="outline"
                  onClick={handleSaveScannedCourse}
                  className="w-full gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Course
                </Button>
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
            <div className="p-4 rounded-xl bg-success/10 border border-success/20 space-y-3">
              <div className="flex items-center gap-2 text-success font-semibold">
                <Check className="w-5 h-5" />
                Course data extracted!
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Course Name</Label>
                <Input
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="Enter course name"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Location (optional)</Label>
                <Input
                  value={courseLocation}
                  onChange={(e) => setCourseLocation(e.target.value)}
                  placeholder="e.g. City, State"
                  className="bg-background"
                />
              </div>
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

              <Button
                variant="outline"
                onClick={handleSaveScannedCourse}
                className="w-full gap-2 mt-2"
              >
                <Save className="w-4 h-4" />
                Save Course for Later
              </Button>
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

                  {/* Saved Players Selector + Find App User for this slot */}
                  <div className="flex gap-2 items-center">
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
                                {sp.name} (HCP: {sp.handicap_index}){sp.linked_user_id ? " ✓ Linked" : ""}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                    {user && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => {
                          setUserSearchSlotIndex(idx);
                          setShowUserSearch(true);
                        }}
                      >
                        <Search className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

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
                  {player.linkedUserId && (
                    <Badge variant="secondary" className="text-[10px] gap-0.5 w-fit">
                      <UserCheck className="w-3 h-3" /> Linked User
                    </Badge>
                  )}
                </div>
              ))}

              {players.length < 8 && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleAddPlayer} className="flex-1">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Player
                  </Button>
                   {user && (
                     <Button variant="outline" onClick={() => { setUserSearchSlotIndex(null); setShowUserSearch(true); }}>
                       <Search className="w-4 h-4" />
                     </Button>
                  )}
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
                                <div className="font-medium flex items-center gap-1.5">
                                  {sp.name}
                                  {sp.linked_user_id && (
                                    <UserCheck className="h-3.5 w-3.5 text-primary" />
                                  )}
                                </div>
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
              <UserSearchDialog
                open={showUserSearch}
                onOpenChange={setShowUserSearch}
                onSelect={handleAppUserSelected}
                title="Find App User"
              />
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

            <GameSelector
              players={players}
              selectedGames={selectedGames}
              onGamesChange={setSelectedGames}
            />
          </div>
        )}

        {/* Step 4: Team Setup (for 6's and Stockton 6's) */}
        {step === 4 && (
          <TeamSetupStep
            players={players.filter(p => p.name.trim())}
            selectedGames={selectedGames}
            onConfirm={(initialGameData) => handleStartRound(initialGameData)}
            onBack={() => setStep(3)}
          />
        )}
      </div>

      {/* Footer - hide on step 4 since TeamSetupStep has its own buttons */}
      {step !== 4 && (
        <div className="p-4 bg-card border-t border-border">
          <Button onClick={handleNext} disabled={!canProceed()} className="w-full h-12 text-lg font-bold">
            {step === 3 && !hasTeamGame ? "Start Round" : "Continue"}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default SetupWizard;
