import { BaseOpenAIProvider } from '../baseOpenAIProvider';

export class DeepSeekProvider extends BaseOpenAIProvider {
  constructor() {
    super({
      name: 'deepseek',
      apiKeyEnvVar: 'DEEPSEEK_API_KEY',
      baseUrlEnvVar: 'DEEPSEEK_BASE_URL',
      modelEnvVar: 'DEEPSEEK_MODEL',
      defaultBaseUrl: 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat',
      supportsJsonResponseFormat: true,
    });
  }
}
