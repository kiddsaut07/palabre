import { GoogleGenAI } from '@google/genai';
import { AIProvider, AIProviderInput, AICapabilities, ProviderHealth } from '../types';
import { AIAnalysisResult } from '../../../src/types';
import {
  COMMON_SYSTEM_INSTRUCTION,
  buildPromptText,
  sanitizeAndValidateAIOutput,
} from '../commonPrompt';

export class GeminiProvider implements AIProvider {
  public readonly name = 'gemini';
  public readonly capabilities: AICapabilities;

  constructor() {
    this.capabilities = {
      text: true,
      audio: true,
      structuredOutput: true,
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
        provider: this.name,
        configured: false,
        reachable: false,
        healthy: false,
        status: 'NOT_CONFIGURED',
        lastCheckedAt: now,
        error: 'GEMINI_API_KEY is not configured',
      };
    }

    const ai = new GoogleGenAI();
    const start = Date.now();
    try {
      // Fast check with flash-lite
      const res = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: 'ping',
      });
      const latencyMs = Date.now() - start;

      if (res.text) {
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
        reachable: true,
        healthy: false,
        latencyMs,
        status: 'INVALID_RESPONSE',
        lastCheckedAt: now,
        error: 'Received empty response from Gemini',
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      const errStr = String(err);
      let status: ProviderHealth['status'] = 'UNAVAILABLE';
      let errorMsg = 'Gemini service unavailable';

      if (errStr.includes('401') || errStr.includes('API_KEY')) {
        errorMsg = 'Invalid Gemini API key';
      } else if (errStr.includes('429')) {
        errorMsg = 'Gemini quota or rate limit exceeded';
      } else if (errStr.includes('503')) {
        errorMsg = 'Gemini high-demand spike (503)';
      }

      return {
        provider: this.name,
        configured: true,
        reachable: false,
        healthy: false,
        latencyMs,
        status,
        lastCheckedAt: now,
        error: errorMsg,
      };
    }
  }

  public async healthCheck(): Promise<boolean> {
    const health = await this.checkHealth();
    return health.healthy;
  }

  public async transcribeAudio(audioBuffer: Buffer, mimeType = 'audio/webm'): Promise<string> {
    if (!this.isConfigured()) {
      return '[Audio recording captured]';
    }

    const ai = new GoogleGenAI();
    let cleanMime = mimeType.split(';')[0].trim();
    if (!cleanMime || cleanMime === 'application/octet-stream') cleanMime = 'audio/webm';

    try {
      const response = await ai.models.generateContent({
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
                text: 'Transcribe the spoken words in this audio recording faithfully. Preserve original language/cadence. If no speech is audible, respond with "[inaudible]". Output ONLY the raw transcript text.',
              },
            ],
          },
        ],
      });
      return response.text?.trim() || '[inaudible]';
    } catch (err) {
      console.warn('[Gemini STT notice]:', err);
      return '[inaudible]';
    }
  }

  public async analyze(input: AIProviderInput): Promise<AIAnalysisResult> {
    if (!this.isConfigured()) {
      throw new Error('Gemini provider is not configured (GEMINI_API_KEY is missing).');
    }

    const ai = new GoogleGenAI();
    const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    const fallbackModel = 'gemini-3.8-flash';

    const promptText = buildPromptText(
      input.missionText,
      input.missionNumber,
      input.transcript,
      input.previousContext
    );

    let cleanMime = (input.mimeType || 'audio/webm').split(';')[0].trim();
    if (!cleanMime || cleanMime === 'application/octet-stream') cleanMime = 'audio/webm';

    // Construct multimodal or text-only parts
    const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];
    if (input.audioBuffer && input.audioBuffer.length > 0) {
      parts.push({
        inlineData: {
          mimeType: cleanMime,
          data: input.audioBuffer.toString('base64'),
        },
      });
    }
    parts.push({ text: promptText });

    let response;
    try {
      response = await ai.models.generateContent({
        model: primaryModel,
        contents: [{ role: 'user', parts: parts as any }],
        config: {
          systemInstruction: COMMON_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
        },
      });
    } catch (primaryErr) {
      console.warn(`[GeminiProvider] Primary model ${primaryModel} failed, trying fallback ${fallbackModel}...`, primaryErr);
      response = await ai.models.generateContent({
        model: fallbackModel,
        contents: [{ role: 'user', parts: parts as any }],
        config: {
          systemInstruction: COMMON_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
        },
      });
    }

    const raw = response.text;
    if (!raw) {
      throw new Error('Gemini returned an empty response.');
    }

    return sanitizeAndValidateAIOutput(raw, input.missionText, input.transcript);
  }
}
