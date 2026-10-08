import { STTProvider, TranscriptResult } from './types';
import { AICapabilities, ProviderHealth } from '../ai/types';
import { GoogleGenAI } from '@google/genai';

/**
 * Open-Source STT Provider (e.g. faster-whisper / whisper.cpp server)
 */
export class WhisperSTTProvider implements STTProvider {
  public readonly name = 'whisper';
  public readonly capabilities: AICapabilities;

  constructor() {
    this.capabilities = {
      text: false,
      audio: true,
      structuredOutput: false,
      transcription: true,
    };
  }

  public isConfigured(): boolean {
    const endpoint = process.env.WHISPER_ENDPOINT;
    return typeof endpoint === 'string' && endpoint.trim().length > 0;
  }

  public async checkHealth(): Promise<ProviderHealth> {
    const now = new Date().toISOString();
    if (!this.isConfigured()) {
      return {
        provider: this.name,
        configured: false,
        reachable: false,
        healthy: false,
        status: 'NOT_CONFIGURED',
        lastCheckedAt: now,
        error: 'WHISPER_ENDPOINT is not configured in environment',
      };
    }

    const endpoint = process.env.WHISPER_ENDPOINT!;
    const controller = new AbortController();
    const timeoutMs = 4000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();

    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (res && res.ok) {
        return {
          provider: this.name,
          configured: true,
          reachable: true,
          healthy: true,
          latencyMs,
          status: 'AVAILABLE',
          lastCheckedAt: now,
          error: null,
        };
      }

      return {
        provider: this.name,
        configured: true,
        reachable: false,
        healthy: false,
        latencyMs,
        status: 'UNAVAILABLE',
        lastCheckedAt: now,
        error: res ? `Whisper service returned HTTP ${res.status}` : 'Unable to connect to Whisper endpoint',
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      return {
        provider: this.name,
        configured: true,
        reachable: false,
        healthy: false,
        latencyMs,
        status: err instanceof Error && err.name === 'AbortError' ? 'TIMEOUT' : 'ERROR',
        lastCheckedAt: now,
        error: err instanceof Error ? err.message : 'Connection failed',
      };
    }
  }

  public async transcribe(audioBuffer: Buffer, mimeType = 'audio/webm'): Promise<TranscriptResult> {
    const endpoint = process.env.WHISPER_ENDPOINT!;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const start = Date.now();

    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
      formData.append('audio', blob, 'audio.webm');

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (!response.ok) {
        throw new Error(`Whisper STT returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const transcript = typeof data.transcript === 'string'
        ? data.transcript.trim()
        : (typeof data.text === 'string' ? data.text.trim() : '');

      return {
        transcript: transcript || '[inaudible]',
        language: data.language,
        confidence: data.confidence,
        providerName: 'whisper',
        latencyMs,
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

/**
 * Gemini STT Provider (Optional speech-to-text fallback)
 */
export class GeminiSTTProvider implements STTProvider {
  public readonly name = 'gemini';
  public readonly capabilities: AICapabilities;

  constructor() {
    this.capabilities = {
      text: true,
      audio: true,
      structuredOutput: true,
      transcription: true,
    };
  }

  public isConfigured(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return typeof key === 'string' && key.trim().length > 0;
  }

  public async checkHealth(): Promise<ProviderHealth> {
    const now = new Date().toISOString();
    if (!this.isConfigured()) {
      return {
        provider: 'gemini_stt',
        configured: false,
        reachable: false,
        healthy: false,
        status: 'NOT_CONFIGURED',
        lastCheckedAt: now,
        error: 'GEMINI_API_KEY is not configured',
      };
    }

    return {
      provider: 'gemini_stt',
      configured: true,
      reachable: true,
      healthy: true,
      status: 'AVAILABLE',
      lastCheckedAt: now,
      error: null,
    };
  }

  public async transcribe(audioBuffer: Buffer, mimeType = 'audio/webm'): Promise<TranscriptResult> {
    const ai = new GoogleGenAI();
    let cleanMime = mimeType.split(';')[0].trim();
    if (!cleanMime || cleanMime === 'application/octet-stream') cleanMime = 'audio/webm';

    const start = Date.now();
    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: cleanMime,
                  data: audioBuffer.toString('base64'),
                },
              },
              {
                text: 'Transcribe the spoken words in this audio recording verbatim. Preserve the speaker\'s original words and cadence. If no speech is intelligible, respond with "[inaudible]". Output ONLY the raw transcript text.',
              },
            ],
          },
        ],
      });
    } catch (transcribeErr) {
      console.warn('[GeminiSTTProvider] gemini-3.5-transcribe notice, falling back to gemini-3.1-flash-lite:', transcribeErr);
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: cleanMime,
                  data: audioBuffer.toString('base64'),
                },
              },
              {
                text: 'Transcribe the spoken words in this audio recording verbatim. Preserve the speaker\'s original words and cadence. If no speech is intelligible, respond with "[inaudible]". Output ONLY the raw transcript text.',
              },
            ],
          },
        ],
      });
    }

    const latencyMs = Date.now() - start;
    return {
      transcript: response.text?.trim() || '[inaudible]',
      providerName: 'gemini-3.5-transcribe',
      latencyMs,
    };
  }
}

export class STTService {
  private providers: STTProvider[] = [];

  constructor() {
    this.providers.push(new WhisperSTTProvider());
    this.providers.push(new GeminiSTTProvider());
  }

  public getProviders(): STTProvider[] {
    return [...this.providers];
  }

  public getActiveSTTProvider(): STTProvider | null {
    return this.providers.find((p) => p.isConfigured()) || null;
  }

  public async getHealth(): Promise<Record<string, ProviderHealth>> {
    const healthMap: Record<string, ProviderHealth> = {};
    for (const p of this.providers) {
      healthMap[p.name] = await p.checkHealth();
    }
    return healthMap;
  }

  public async transcribe(audioBuffer: Buffer, mimeType = 'audio/webm'): Promise<TranscriptResult> {
    const active = this.getActiveSTTProvider();

    if (!active) {
      return {
        transcript: '[Audio recording captured - STT provider not configured]',
        providerName: 'none',
        latencyMs: 0,
      };
    }

    try {
      return await active.transcribe(audioBuffer, mimeType);
    } catch (err) {
      console.warn(`[STT] Provider ${active.name} transcription failed:`, err);
      // Try next configured provider if any
      const fallback = this.providers.find((p) => p !== active && p.isConfigured());
      if (fallback) {
        console.log(`[STT] Falling back to STT provider: ${fallback.name}...`);
        return await fallback.transcribe(audioBuffer, mimeType);
      }
      return {
        transcript: '[inaudible]',
        providerName: 'error_fallback',
        latencyMs: 0,
      };
    }
  }
}

export const sttService = new STTService();
