import { AICapabilities, ProviderHealth } from '../ai/types';

export interface TranscriptResult {
  transcript: string;
  language?: string;
  confidence?: number;
  providerName: string;
  latencyMs?: number;
}

export interface STTProvider {
  readonly name: string;
  readonly capabilities: AICapabilities;
  isConfigured(): boolean;
  checkHealth(): Promise<ProviderHealth>;
  transcribe(audioBuffer: Buffer, mimeType?: string): Promise<TranscriptResult>;
}
