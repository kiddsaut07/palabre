import { aiOrchestrator } from './ai/aiOrchestrator';
import { AIAnalysisResult } from '../src/types';

export interface AnalyzeOptions {
  audioBuffer?: Buffer;
  mimeType?: string;
  transcript?: string;
  missionText: string;
  missionNumber: number;
  previousContext?: string;
}

/**
 * Main AI entry point for PALABRE.
 * Dispatches to the multi-provider AI Orchestrator (Qwen, DeepSeek, GLM, Gemini, or auto fallback).
 */
export async function analyzeAudioRecording(options: AnalyzeOptions): Promise<AIAnalysisResult & { providerUsed: string }> {
  return aiOrchestrator.analyze({
    audioBuffer: options.audioBuffer,
    mimeType: options.mimeType,
    transcript: options.transcript,
    missionText: options.missionText,
    missionNumber: options.missionNumber,
    previousContext: options.previousContext,
  });
}

export { aiOrchestrator };
