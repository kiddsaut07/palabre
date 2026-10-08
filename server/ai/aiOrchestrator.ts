import {
  AIProvider,
  AIProviderInput,
  OrchestratorStatus,
  ProviderHealth,
  AICapabilities,
  RequestMetrics,
} from './types';
import { AIAnalysisResult } from '../../src/types';
import { OllamaProvider } from './providers/ollamaProvider';
import { QwenProvider } from './providers/qwenProvider';
import { DeepSeekProvider } from './providers/deepseekProvider';
import { GLMProvider } from './providers/glmProvider';
import { GeminiProvider } from './providers/geminiProvider';
import { sttService } from '../stt/sttService';

const DEFAULT_HEALTH_CACHE_TTL_MS = 30000; // 30 seconds cache to prevent spamming endpoints

export class AIOrchestrator {
  private providers: Map<string, AIProvider> = new Map();
  private healthCache: { timestamp: number; data: Record<string, ProviderHealth> } | null = null;
  private lastMetrics: RequestMetrics | null = null;
  private monitorHook: {
    isProviderHealthy: (name: string) => boolean;
    getStatus: () => { isRunning: boolean; intervalMs: number; stats: Record<string, unknown> };
  } | null = null;

  constructor() {
    // Register all supported LLM providers
    this.providers.set('ollama', new OllamaProvider());
    this.providers.set('qwen', new QwenProvider());
    this.providers.set('deepseek', new DeepSeekProvider());
    this.providers.set('glm', new GLMProvider());
    this.providers.set('gemini', new GeminiProvider());
  }

  public setMonitor(monitor: {
    isProviderHealthy: (name: string) => boolean;
    getStatus: () => { isRunning: boolean; intervalMs: number; stats: Record<string, unknown> };
  }): void {
    this.monitorHook = monitor;
  }

  public getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name.toLowerCase());
  }

  public getConfiguredOrder(): string[] {
    const rawOrder = process.env.AI_PROVIDER_ORDER || 'ollama,qwen,deepseek,glm,gemini';
    return rawOrder
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter((p) => this.providers.has(p));
  }

  public getCapabilities(): Record<string, AICapabilities> {
    const caps: Record<string, AICapabilities> = {};
    for (const [name, provider] of this.providers.entries()) {
      caps[name] = provider.capabilities;
    }
    // Also include STT providers
    for (const stt of sttService.getProviders()) {
      caps[`stt_${stt.name}`] = stt.capabilities;
    }
    return caps;
  }

  public async getHealth(force = false): Promise<Record<string, ProviderHealth>> {
    const now = Date.now();
    const ttl = parseInt(process.env.HEALTH_CACHE_TTL || `${DEFAULT_HEALTH_CACHE_TTL_MS}`, 10);

    if (!force && this.healthCache && now - this.healthCache.timestamp < ttl) {
      return this.healthCache.data;
    }

    const healthMap: Record<string, ProviderHealth> = {};
    const checkPromises = Array.from(this.providers.entries()).map(async ([name, provider]) => {
      try {
        const health = await provider.checkHealth();
        healthMap[name] = health;
      } catch (err: unknown) {
        healthMap[name] = {
          provider: name,
          configured: provider.isConfigured(),
          reachable: false,
          healthy: false,
          status: 'ERROR',
          lastCheckedAt: new Date().toISOString(),
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    });

    await Promise.all(checkPromises);

    // Also include STT health
    try {
      const sttHealth = await sttService.getHealth();
      for (const [name, h] of Object.entries(sttHealth)) {
        healthMap[`stt_${name}`] = h;
      }
    } catch {
      // ignore stt health failure
    }

    this.healthCache = { timestamp: now, data: healthMap };
    return healthMap;
  }

  public async getStatus(forceHealthCheck = false): Promise<OrchestratorStatus> {
    const mode = (process.env.AI_PROVIDER || 'auto').toLowerCase();
    const configuredMap: Record<string, boolean> = {};

    for (const [name, provider] of this.providers.entries()) {
      configuredMap[name] = provider.isConfigured();
    }

    const order = this.getConfiguredOrder();
    let active = mode;
    if (mode === 'auto') {
      const firstConfigured = order.find((p) => this.providers.get(p)?.isConfigured());
      active = firstConfigured || 'none';
    }

    const health = await this.getHealth(forceHealthCheck);
    const capabilities = this.getCapabilities();

    return {
      mode,
      activeProvider: active,
      configuredProviders: configuredMap,
      fallbackOrder: order,
      capabilities,
      health,
      lastMetrics: this.lastMetrics,
      monitor: this.monitorHook ? this.monitorHook.getStatus() : undefined,
    };
  }

  public async analyze(input: AIProviderInput): Promise<AIAnalysisResult & { providerUsed: string }> {
    const requestStartTime = Date.now();
    const mode = (process.env.AI_PROVIDER || 'auto').toLowerCase();
    const isDemo = process.env.DEMO_MODE === 'true';

    let candidates: AIProvider[] = [];

    if (mode !== 'auto') {
      const selected = this.providers.get(mode);
      if (!selected) {
        throw new Error(
          `Configured AI_PROVIDER="${mode}" is unrecognized. Supported providers: ollama, qwen, deepseek, glm, gemini, auto.`
        );
      }
      if (!selected.isConfigured()) {
        if (mode === 'ollama') {
          throw new Error(
            'Provider "ollama" is requested, but OLLAMA_BASE_URL is not configured in environment variables.'
          );
        }
        throw new Error(
          `Provider "${mode}" is requested, but its API key is not configured in environment variables.`
        );
      }
      candidates = [selected];
    } else {
      // Auto mode: gather all configured providers in order of preference
      const order = this.getConfiguredOrder();
      for (const name of order) {
        const p = this.providers.get(name);
        if (p && p.isConfigured()) {
          candidates.push(p);
        }
      }

      // If monitor hook is active and has recorded health, prioritize verified healthy candidates
      if (this.monitorHook && candidates.length > 1) {
        const healthyOnes: AIProvider[] = [];
        const otherOnes: AIProvider[] = [];

        for (const candidate of candidates) {
          if (this.monitorHook.isProviderHealthy(candidate.name)) {
            healthyOnes.push(candidate);
          } else {
            otherOnes.push(candidate);
          }
        }

        // If at least one configured provider is verified healthy, place it first
        if (healthyOnes.length > 0) {
          candidates = [...healthyOnes, ...otherOnes];
        }
      }

      if (candidates.length === 0) {
        if (isDemo) {
          console.warn('[AIOrchestrator] No AI providers configured. Operating in DEMO_MODE fallback.');
          return {
            ...this.getDemoFallback(input.missionText),
            providerUsed: 'demo_fallback',
          };
        }
        throw new Error(
          'No AI provider is configured. Please configure at least one provider (e.g. OLLAMA_BASE_URL, QWEN_API_KEY, DEEPSEEK_API_KEY, GLM_API_KEY, or GEMINI_API_KEY).'
        );
      }
    }

    const inputMode: 'audio' | 'text' = input.audioBuffer && input.audioBuffer.length > 0 ? 'audio' : 'text';
    let preparedInput = { ...input };
    let sttProviderUsed: string | undefined;
    let sttLatencyMs: number | undefined;

    // ==========================================
    // CAPABILITY ROUTING (Audio -> STT -> Transcript)
    // ==========================================
    if (inputMode === 'audio' && !preparedInput.transcript) {
      const targetProvider = candidates[0];

      // If target provider is text-only (Qwen, DeepSeek, GLM), audio MUST be transcribed first
      if (!targetProvider.capabilities.audio) {
        console.log(`[AI] input=audio stt_routing=active target_llm=${targetProvider.name} (text-only)`);
        const sttStart = Date.now();
        try {
          const sttResult = await sttService.transcribe(
            preparedInput.audioBuffer!,
            preparedInput.mimeType
          );
          sttLatencyMs = Date.now() - sttStart;
          sttProviderUsed = sttResult.providerName;
          preparedInput.transcript = sttResult.transcript;
          console.log(`[AI] stt=${sttResult.providerName} latency=${sttLatencyMs}ms`);
        } catch (sttErr) {
          sttLatencyMs = Date.now() - sttStart;
          console.warn('[AI] STT transcription failed, using fallback notice:', sttErr);
          preparedInput.transcript = '[Audio recording captured]';
        }
      } else {
        console.log(`[AI] input=audio target_llm=${targetProvider.name} (native multimodal audio supported)`);
      }
    }

    // ==========================================
    // LLM DISPATCH WITH AUTOMATIC FALLBACK
    // ==========================================
    const errors: string[] = [];
    let fallbacksCount = 0;

    for (let i = 0; i < candidates.length; i++) {
      const provider = candidates[i];
      const llmStart = Date.now();
      console.log(`[AI] selected=${provider.name} (attempt ${i + 1}/${candidates.length})`);

      try {
        const result = await provider.analyze(preparedInput);
        const llmLatencyMs = Date.now() - llmStart;
        const totalLatencyMs = Date.now() - requestStartTime;

        console.log(
          `[AI] ${provider.name} success latency=${llmLatencyMs}ms total=${totalLatencyMs}ms fallback=${fallbacksCount === 0 ? 'none' : `${fallbacksCount} attempts`}`
        );

        this.lastMetrics = {
          timestamp: new Date().toISOString(),
          inputMode,
          sttProvider: sttProviderUsed,
          sttLatencyMs,
          llmProvider: provider.name,
          llmLatencyMs,
          totalLatencyMs,
          fallbacksCount,
          status: 'success',
        };

        return {
          ...result,
          providerUsed: provider.name,
        };
      } catch (err: unknown) {
        const llmLatencyMs = Date.now() - llmStart;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[AI] ${provider.name} failed latency=${llmLatencyMs}ms error="${msg}"`);
        errors.push(`${provider.name}: ${msg}`);

        if (i < candidates.length - 1) {
          fallbacksCount++;
          console.log(`[AI] fallback=${candidates[i + 1].name}`);
        }
      }
    }

    const totalLatencyMs = Date.now() - requestStartTime;
    this.lastMetrics = {
      timestamp: new Date().toISOString(),
      inputMode,
      sttProvider: sttProviderUsed,
      sttLatencyMs,
      llmProvider: 'none',
      llmLatencyMs: 0,
      totalLatencyMs,
      fallbacksCount,
      status: 'error',
    };

    if (isDemo) {
      console.warn('[AIOrchestrator] All providers failed. Falling back to DEMO_MODE response.');
      return {
        ...this.getDemoFallback(input.missionText),
        providerUsed: 'demo_fallback',
      };
    }

    throw new Error(`All configured AI providers failed. Details: ${errors.join(' | ')}`);
  }

  private getDemoFallback(missionText: string): AIAnalysisResult {
    return {
      transcript: "Dans notre quartier, les aînés nous disaient toujours : l'eau qui a coulé sous le pont ne revient jamais en arrière, mais la trace de la source reste toujours dans la terre.",
      theme: "memory",
      extracted: "« L'eau qui a coulé sous le pont ne revient pas, mais la trace de la source reste dans la terre. »",
      summary: "A neighborhood elder shared an authentic Cameroonian proverb about origin and memory.",
      culturalSignificance: "Preserves community wisdom on honoring family origins.",
      nextMission: "Find someone in your neighborhood who works with stone, wood, or fabric. Ask them what traditional tool no machine can replace.",
    };
  }
}

export const aiOrchestrator = new AIOrchestrator();
