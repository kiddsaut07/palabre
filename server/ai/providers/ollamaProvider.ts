import { BaseOpenAIProvider } from '../baseOpenAIProvider';

/**
 * Open-source local provider (Ollama OpenAI-compatible endpoint).
 *
 * Deliberately OPTIONAL: it is only considered configured when OLLAMA_BASE_URL
 * is explicitly set, so environments without Ollama keep working unchanged and
 * fall through to the existing cloud providers.
 */
export class OllamaProvider extends BaseOpenAIProvider {
  constructor() {
    super({
      name: 'ollama',
      apiKeyEnvVar: 'OLLAMA_API_KEY',
      baseUrlEnvVar: 'OLLAMA_BASE_URL',
      modelEnvVar: 'OLLAMA_MODEL',
      defaultBaseUrl: 'http://localhost:11434/v1',
      defaultModel: 'qwen2.5:7b',
      // Ollama tolerates but does not require JSON mode; keep it off for older versions.
      supportsJsonResponseFormat: false,
    });
  }

  public isConfigured(): boolean {
    const baseUrl = process.env.OLLAMA_BASE_URL;
    return typeof baseUrl === 'string' && baseUrl.trim().length > 0;
  }

  protected getApiKey(): string | undefined {
    return process.env.OLLAMA_API_KEY?.trim() || 'ollama-local';
  }
}
