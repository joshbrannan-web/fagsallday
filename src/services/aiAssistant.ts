import { Player } from '../types';

export interface AiValidationResult {
  isValid: boolean;
  message?: string;
  severity: 'info' | 'warning' | 'error';
}

export interface VoiceCommand {
  action: 'SCORE' | 'BANKER' | 'UNKNOWN';
  playerId?: string;
  score?: number;
  holeNumber?: number;
}

/**
 * Validates a hole score input for reasonableness
 */
export const validateHoleInput = (
  score: number,
  par: number,
  player: Player
): AiValidationResult => {
  // Check for impossibly low scores
  if (score < 1) {
    return {
      isValid: false,
      message: 'Score must be at least 1',
      severity: 'error'
    };
  }

  // Check for unusually high scores (e.g., 10+ over par)
  if (score > par + 10) {
    return {
      isValid: true,
      message: `${score} is very high for a par ${par}. Double-check if correct.`,
      severity: 'warning'
    };
  }

  // Check for unusually low scores (e.g., more than 3 under par)
  if (score < par - 3) {
    return {
      isValid: true,
      message: `${score} on a par ${par} is exceptional! Confirm if correct.`,
      severity: 'warning'
    };
  }

  return {
    isValid: true,
    severity: 'info'
  };
};

/**
 * Interprets voice commands for score entry
 * Supports formats like:
 * - "John got a birdie"
 * - "Mike scored 5"
 * - "Par for Sarah"
 */
export const interpretVoiceCommand = (
  transcript: string,
  players: Player[],
  currentHole: number
): VoiceCommand => {
  const lower = transcript.toLowerCase().trim();

  // Try to find a player name in the transcript
  let matchedPlayer: Player | undefined;
  for (const player of players) {
    const nameLower = player.name.toLowerCase();
    if (lower.includes(nameLower)) {
      matchedPlayer = player;
      break;
    }
    // Also try first name only
    const firstName = nameLower.split(' ')[0];
    if (firstName.length > 2 && lower.includes(firstName)) {
      matchedPlayer = player;
      break;
    }
  }

  if (!matchedPlayer) {
    return { action: 'UNKNOWN' };
  }

  // Try to extract score
  let score: number | undefined;

  // Check for relative scores (birdie, par, bogey, etc.)
  if (lower.includes('eagle') || lower.includes('two under')) {
    score = -2; // Will be converted to absolute in caller
  } else if (lower.includes('birdie') || lower.includes('one under')) {
    score = -1;
  } else if (lower.includes('par') || lower.includes('even')) {
    score = 0;
  } else if (lower.includes('bogey') || lower.includes('one over')) {
    score = 1;
  } else if (lower.includes('double bogey') || lower.includes('double') || lower.includes('two over')) {
    score = 2;
  } else if (lower.includes('triple bogey') || lower.includes('triple') || lower.includes('three over')) {
    score = 3;
  } else {
    // Try to find a numeric score
    const numbers = lower.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      const num = parseInt(numbers[0], 10);
      if (num >= 1 && num <= 15) {
        score = num;
      }
    }
  }

  if (score !== undefined) {
    return {
      action: 'SCORE',
      playerId: matchedPlayer.id,
      score,
      holeNumber: currentHole
    };
  }

  return { action: 'UNKNOWN' };
};
