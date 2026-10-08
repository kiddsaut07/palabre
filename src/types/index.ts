/**
 * Core type definitions for PALABRE
 */

export interface StarterQuest {
  id: string;
  missionNumber: number;
  missionText: string;
  theme: string;
  targetContext?: string;
}

export interface Story {
  id: string;
  sessionId: string;
  userId?: string;
  missionNumber: number;
  missionText: string;
  audioDurationSec?: number;
  audioMimeType?: string;
  audioUrl?: string;
  outdoorDurationSec?: number;
  outdoorDistanceM?: number;
  transcript: string;
  theme: string;
  extracted: string;
  summary: string;
  culturalSignificance: string;
  nextMission: string;
  createdAt: string;
}

export interface AIAnalysisResult {
  transcript: string;
  theme: string;
  extracted: string;
  summary: string;
  culturalSignificance: string;
  nextMission: string;
  providerUsed?: string;
}

export interface AnalyzeResponse extends AIAnalysisResult {
  success: boolean;
  nextMissionNumber: number;
  sessionCount: number;
  totalStories: number;
  storyId?: string;
  providerUsed?: string;
  proof?: {
    durationSec?: number;
    distanceM?: number;
  };
}

export type ScreenState = 
  | 'HOME'
  | 'CONSENT'
  | 'MISSION'
  | 'RECORDING'
  | 'PROCESSING'
  | 'RESULT'
  | 'NEXT_MISSION';

export type ErrorType =
  | 'MICROPHONE_DENIED'
  | 'NETWORK_ERROR'
  | 'AI_ERROR'
  | 'AUDIO_TOO_SHORT'
  | 'AUDIO_TOO_LARGE'
  | 'INVALID_RECORDING'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

export interface AppError {
  type: ErrorType;
  message: string;
  details?: string;
}

export interface UserSession {
  sessionId: string;
  missionNumber: number;
  currentMission: string;
  currentTheme: string;
  nextMission?: string;
  sessionStoryCount: number;
}
