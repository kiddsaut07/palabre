import { BaseOpenAIProvider } from '../baseOpenAIProvider';

export class QwenProvider extends BaseOpenAIProvider {
  constructor() {
    super({
      name: 'qwen',
      apiKeyEnvVar: 'QWEN_API_KEY',
      baseUrlEnvVar: 'QWEN_BASE_URL',
      modelEnvVar: 'QWEN_MODEL',
      defaultBaseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      defaultModel: 'qwen2.5-72b-instruct',
      supportsJsonResponseFormat: true,
    });
  }
}
