import { BaseOpenAIProvider } from '../baseOpenAIProvider';

export class GLMProvider extends BaseOpenAIProvider {
  constructor() {
    super({
      name: 'glm',
      apiKeyEnvVar: 'GLM_API_KEY',
      baseUrlEnvVar: 'GLM_BASE_URL',
      modelEnvVar: 'GLM_MODEL',
      defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      defaultModel: 'glm-4-flash',
      supportsJsonResponseFormat: false, // GLM handles markdown json blocks reliably
    });
  }
}
