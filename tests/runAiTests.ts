import assert from 'assert';
import { OllamaProvider } from '../server/ai/providers/ollamaProvider';
import { QwenProvider } from '../server/ai/providers/qwenProvider';
import { DeepSeekProvider } from '../server/ai/providers/deepseekProvider';
import { GLMProvider } from '../server/ai/providers/glmProvider';
import { GeminiProvider } from '../server/ai/providers/geminiProvider';
import { AIOrchestrator } from '../server/ai/aiOrchestrator';
import { sanitizeAndValidateAIOutput, buildPromptText } from '../server/ai/commonPrompt';

async function runTestSuite() {
  console.log('--- PALABRE MULTI-PROVIDER AI TEST SUITE ---');
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err: unknown) {
      console.error(`[FAIL] ${name}:`, err);
      failed++;
    }
  }

  // 1. Qwen Provider Config & Detection
  await test('QwenProvider handles unconfigured state correctly', () => {
    delete process.env.QWEN_API_KEY;
    const qwen = new QwenProvider();
    assert.strictEqual(qwen.name, 'qwen');
    assert.strictEqual(qwen.isConfigured(), false);
  });

  await test('QwenProvider detects configured state and default model', () => {
    process.env.QWEN_API_KEY = 'test-qwen-key';
    const qwen = new QwenProvider();
    assert.strictEqual(qwen.isConfigured(), true);
    delete process.env.QWEN_API_KEY;
  });

  // 2. DeepSeek Provider Config & Detection
  await test('DeepSeekProvider handles unconfigured state correctly', () => {
    delete process.env.DEEPSEEK_API_KEY;
    const ds = new DeepSeekProvider();
    assert.strictEqual(ds.name, 'deepseek');
    assert.strictEqual(ds.isConfigured(), false);
  });

  await test('DeepSeekProvider detects configured state and custom model', () => {
    process.env.DEEPSEEK_API_KEY = 'test-ds-key';
    process.env.DEEPSEEK_MODEL = 'deepseek-coder';
    const ds = new DeepSeekProvider();
    assert.strictEqual(ds.isConfigured(), true);
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_MODEL;
  });

  // 3. GLM Provider Config & Detection
  await test('GLMProvider handles unconfigured state correctly', () => {
    delete process.env.GLM_API_KEY;
    const glm = new GLMProvider();
    assert.strictEqual(glm.name, 'glm');
    assert.strictEqual(glm.isConfigured(), false);
  });

  // 4. Gemini Provider Config & Detection
  await test('GeminiProvider detects API key configuration', () => {
    const gemini = new GeminiProvider();
    assert.strictEqual(gemini.name, 'gemini');
    assert.strictEqual(typeof gemini.isConfigured(), 'boolean');
  });

  // 5. Output Sanitization & Strict Schema Validation
  await test('sanitizeAndValidateAIOutput parses clean JSON', () => {
    const raw = JSON.stringify({
      transcript: 'La patience est une vertu transmise par nos aïeux.',
      theme: 'Patience',
      extracted: 'La patience est la racine de la sagesse.',
      summary: 'Une réflexion sur la patience.',
      culturalSignificance: 'Transmission orale intergénérationnelle.',
      nextMission: 'Trouve un artisan potier.',
    });
    const result = sanitizeAndValidateAIOutput(raw, 'Mission 1');
    assert.strictEqual(result.theme, 'patience');
    assert.strictEqual(result.transcript, 'La patience est une vertu transmise par nos aïeux.');
    assert.strictEqual(result.nextMission, 'Trouve un artisan potier.');
  });

  await test('sanitizeAndValidateAIOutput handles markdown codeblocks', () => {
    const raw = "```json\n{\n  \"transcript\": \"Ecoute les anciens.\",\n  \"theme\": \"Sagesse\",\n  \"extracted\": \"Ecoute\",\n  \"summary\": \"Conseil.\",\n  \"culturalSignificance\": \"Valeur d'écoute.\",\n  \"nextMission\": \"Demande au cordonnier.\"\n}\n```";
    const result = sanitizeAndValidateAIOutput(raw, 'Mission 1');
    assert.strictEqual(result.theme, 'sagesse');
    assert.strictEqual(result.transcript, 'Ecoute les anciens.');
  });

  await test('sanitizeAndValidateAIOutput handles surrounding commentary text', () => {
    const raw = "Here is your analysis:\n{\n  \"transcript\": \"Voici mon histoire.\",\n  \"theme\": \"Courage\",\n  \"extracted\": \"Le courage avance\",\n  \"summary\": \"Courage d'un jeune homme\",\n  \"culturalSignificance\": \"Courage urbain\",\n  \"nextMission\": \"Parle à un conducteur de moto-taxi.\"\n}\nHope this helps!";
    const result = sanitizeAndValidateAIOutput(raw, 'Mission 1');
    assert.strictEqual(result.theme, 'courage');
    assert.strictEqual(result.nextMission, 'Parle à un conducteur de moto-taxi.');
  });

  await test('sanitizeAndValidateAIOutput throws on completely invalid output', () => {
    assert.throws(() => {
      sanitizeAndValidateAIOutput('Sorry, I am not able to process this request.', 'Mission 1');
    }, /Failed to parse LLM JSON output/);
  });

  // 6. AI Orchestrator Status
  await test('AIOrchestrator getStatus exposes safe configuration booleans without secrets', async () => {
    const orchestrator = new AIOrchestrator();
    const status = await orchestrator.getStatus();
    assert.ok(status.mode);
    assert.ok(status.activeProvider);
    assert.ok(Array.isArray(status.fallbackOrder));
    assert.strictEqual(typeof status.configuredProviders.qwen, 'boolean');
    assert.strictEqual(typeof status.configuredProviders.deepseek, 'boolean');
    assert.strictEqual(typeof status.configuredProviders.glm, 'boolean');
    assert.strictEqual(typeof status.configuredProviders.gemini, 'boolean');
  });

  // 7. AI Orchestrator Unconfigured Error Handling
  await test('AIOrchestrator rejects unconfigured specific provider', async () => {
    process.env.AI_PROVIDER = 'qwen';
    delete process.env.QWEN_API_KEY;
    const orchestrator = new AIOrchestrator();
    await assert.rejects(
      async () => {
        await orchestrator.analyze({
          missionText: 'Trouve un ancien',
          missionNumber: 1,
        });
      },
      /is requested, but its API key is not configured/
    );
    delete process.env.AI_PROVIDER;
  });

  // 8. AI Orchestrator Auto Fallback
  await test('AIOrchestrator falls back cleanly to DEMO_MODE when no provider is configured', async () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.QWEN_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.GLM_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const orchestrator = new AIOrchestrator();
    const result = await orchestrator.analyze({
      missionText: 'Trouve un ancien',
      missionNumber: 1,
    });
    assert.strictEqual(result.providerUsed, 'demo_fallback');
    assert.ok(result.extracted);
    assert.ok(result.nextMission);
    delete process.env.DEMO_MODE;
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
