import { AIProvider, AIProviderInput, AICapabilities, ProviderHealth } from './types';
import { AIAnalysisResult } from '../../src/types';
import {
  COMMON_SYSTEM_INSTRUCTION,
  buildPromptText,
  sanitizeAndValidateAIOutput,
} from './commonPrompt';

export interface BaseOpenAIConfig {
  name: string;
  apiKeyEnvVar: string;
  baseUrlEnvVar: string;
  modelEnvVar: string;
  defaultBaseUrl: string;
  defaultModel: string;
  supportsJsonResponseFormat?: boolean;
}

export class BaseOpenAIProvider implements AIProvider {
  public readonly name: string;
  public readonly capabilities: AICapabilities;
  protected readonly config: BaseOpenAIConfig;

  constructor(config: BaseOpenAIConfig) {
    this.name = config.name;
    this.config = config;
    this.capabilities = {
      text: true,
      audio: false,
      structuredOutput: true,
    };
  }

  protected getApiKey(): string | undefined {
    return process.env[this.config.apiKeyEnvVar];
  }

  protected getBaseUrl(): string {
    const raw = process.env[this.config.baseUrlEnvVar] || this.config.defaultBaseUrl;
    // Strip trailing slashes
    return raw.replace(/\/+$/, '');
  }

  protected getModel(): string {
    return process.env[this.config.modelEnvVar] || this.config.defaultModel;
  }

  public isConfigured(): boolean {
    const key = this.getApiKey();
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
        error: `Environment variable ${this.config.apiKeyEnvVar} is missing.`,
      };
    }

    const apiKey = this.getApiKey()!;
    const baseUrl = this.getBaseUrl();
    const model = this.getModel();
    const endpoint = `${baseUrl}/chat/completions`;

    const controller = new AbortController();
    const timeoutMs = 6000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();

    try {
      // Send a lightweight ping prompt to test live credentials and model availability
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (res.ok) {
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

      let errorMsg = `HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403) {
        errorMsg = 'Authentication failed (invalid key or insufficient balance)';
      } else if (res.status === 429) {
        errorMsg = 'Rate limit or quota exceeded';
      } else if (res.status >= 500) {
        errorMsg = `Server error from upstream API (${res.status})`;
      }

      return {
        provider: this.name,
        configured: true,
        reachable: true,
        healthy: false,
        latencyMs,
        status: 'UNAVAILABLE',
        lastCheckedAt: now,
        error: errorMsg,
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (err instanceof Error && err.name === 'AbortError') {
        return {
          provider: this.name,
          configured: true,
          reachable: false,
          healthy: false,
          latencyMs,
          status: 'TIMEOUT',
          lastCheckedAt: now,
          error: `Health ping timed out after ${timeoutMs}ms`,
        };
      }

      return {
        provider: this.name,
        configured: true,
        reachable: false,
        healthy: false,
        latencyMs,
        status: 'ERROR',
        lastCheckedAt: now,
        error: 'Network connection failed',
      };
    }
  }

  public async healthCheck(): Promise<boolean> {
    const health = await this.checkHealth();
    return health.healthy;
  }

  public async analyze(input: AIProviderInput): Promise<AIAnalysisResult> {
    if (!this.isConfigured()) {
      throw new Error(`Provider ${this.name} is not configured (${this.config.apiKeyEnvVar} is missing).`);
    }

    const apiKey = this.getApiKey()!;
    const baseUrl = this.getBaseUrl();
    const model = this.getModel();

    const promptText = buildPromptText(
      input.missionText,
      input.missionNumber,
      input.transcript,
      input.previousContext
    );

    const endpoint = `${baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timeoutMs = 25000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const requestBody: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: COMMON_SYSTEM_INSTRUCTION },
        { role: 'user', content: promptText },
      ],
      temperature: 0.3,
    };

    if (this.config.supportsJsonResponseFormat) {
      requestBody.response_format = { type: 'json_object' };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        // Clean error message to prevent leaking credentials
        let safeError = `HTTP ${response.status} from ${this.name}`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error?.message) {
            safeError += `: ${parsed.error.message}`;
          }
        } catch {
          if (errorText && errorText.length < 200) {
            safeError += `: ${errorText}`;
          }
        }
        throw new Error(safeError);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent || typeof rawContent !== 'string') {
        throw new Error(`${this.name} returned an empty message content.`);
      }

      return sanitizeAndValidateAIOutput(rawContent, input.missionText, input.transcript);
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`${this.name} request timed out after ${timeoutMs / 1000}s.`);
      }
      throw err;
    }
  }
}
