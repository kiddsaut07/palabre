import { AIAnalysisResult } from '../../src/types';

export type HealthStatusType =
  | 'NOT_CONFIGURED'
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'ERROR';

export interface ProviderHealth {
  provider: string;
  configured: boolean;
  reachable: boolean;
  healthy: boolean;
  latencyMs?: number;
  lastCheckedAt: string;
  status: HealthStatusType;
  error?: string | null;
}

export interface AICapabilities {
  text: boolean;
  audio: boolean;
  structuredOutput: boolean;
  transcription?: boolean;
}

export interface AIProviderInput {
  audioBuffer?: Buffer;
  mimeType?: string;
  transcript?: string;
  missionText: string;
  missionNumber: number;
  previousContext?: string;
}

export interface AIProvider {
  readonly name: string;
  readonly capabilities: AICapabilities;
  isConfigured(): boolean;
  checkHealth(): Promise<ProviderHealth>;
  analyze(input: AIProviderInput): Promise<AIAnalysisResult>;
}

export interface RequestMetrics {
  timestamp: string;
  inputMode: 'audio' | 'text';
  sttProvider?: string;
  sttLatencyMs?: number;
  llmProvider: string;
  llmLatencyMs: number;
  totalLatencyMs: number;
  fallbacksCount: number;
  status: 'success' | 'error';
}

export interface OrchestratorStatus {
  mode: string;
  activeProvider: string;
  configuredProviders: Record<string, boolean>;
  fallbackOrder: string[];
  capabilities: Record<string, AICapabilities>;
  health: Record<string, ProviderHealth>;
  lastMetrics?: RequestMetrics | null;
  monitor?: {
    isRunning: boolean;
    intervalMs: number;
    stats: Record<string, unknown>;
  };
}
