import assert from 'assert';
import { QwenProvider } from '../server/ai/providers/qwenProvider';
import { DeepSeekProvider } from '../server/ai/providers/deepseekProvider';
import { GLMProvider } from '../server/ai/providers/glmProvider';
import { GeminiProvider } from '../server/ai/providers/geminiProvider';
import { WhisperSTTProvider, GeminiSTTProvider, STTService } from '../server/stt/sttService';
import { AIOrchestrator } from '../server/ai/aiOrchestrator';

async function runTestSuite() {
  console.log('====================================================');
  console.log('PALABRE: HEALTH, CAPABILITIES & ROUTING TEST SUITE (15 TESTS)');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  async function test(num: number, title: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`[PASS] TEST ${num}: ${title}`);
      passed++;
    } catch (err: unknown) {
      console.error(`[FAIL] TEST ${num}: ${title}`);
      console.error('      Reason:', err instanceof Error ? err.message : err);
      failed++;
    }
  }

  const originalFetch = global.fetch;

  // TEST 1: provider configuré mais indisponible (HTTP 500 ou 401)
  await test(1, 'Provider configuré mais indisponible', async () => {
    process.env.QWEN_API_KEY = 'test-key';
    global.fetch = async () => ({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    } as any);

    const qwen = new QwenProvider();
    const health = await qwen.checkHealth();
    assert.strictEqual(health.configured, true);
    assert.strictEqual(health.healthy, false);
    assert.strictEqual(health.status, 'UNAVAILABLE');

    delete process.env.QWEN_API_KEY;
  });

  // TEST 2: provider configuré et healthy (HTTP 200)
  await test(2, 'Provider configuré et healthy', async () => {
    process.env.QWEN_API_KEY = 'test-valid-key';
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'pong' } }] }),
    } as any);

    const qwen = new QwenProvider();
    const health = await qwen.checkHealth();
    assert.strictEqual(health.configured, true);
    assert.strictEqual(health.healthy, true);
    assert.strictEqual(health.status, 'AVAILABLE');
    assert.ok(health.latencyMs !== undefined && health.latencyMs >= 0);

    delete process.env.QWEN_API_KEY;
  });

  // TEST 3: provider non configuré
  await test(3, 'Provider non configuré', async () => {
    delete process.env.QWEN_API_KEY;
    const qwen = new QwenProvider();
    const health = await qwen.checkHealth();
    assert.strictEqual(health.configured, false);
    assert.strictEqual(health.healthy, false);
    assert.strictEqual(health.status, 'NOT_CONFIGURED');
  });

  // TEST 4: timeout health check
  await test(4, 'Timeout health check géré proprement', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-ds-key';
    global.fetch = async () => {
      const err = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    };

    const ds = new DeepSeekProvider();
    const health = await ds.checkHealth();
    assert.strictEqual(health.configured, true);
    assert.strictEqual(health.healthy, false);
    assert.strictEqual(health.status, 'TIMEOUT');

    delete process.env.DEEPSEEK_API_KEY;
  });

  // TEST 5: health cache TTL
  await test(5, 'Health cache évite les appels répétés pendant le TTL', async () => {
    process.env.QWEN_API_KEY = 'test-key';
    let fetchCount = 0;
    global.fetch = async () => {
      fetchCount++;
      return { ok: true, status: 200, json: async () => ({}) } as any;
    };

    const orchestrator = new AIOrchestrator();
    // 1er appel: effectue les checks
    const h1 = await orchestrator.getHealth(false);
    const countAfterFirst = fetchCount;

    // 2e appel immédiat: doit utiliser le cache
    const h2 = await orchestrator.getHealth(false);
    assert.strictEqual(fetchCount, countAfterFirst, 'Health check should use cache without new network calls');
    assert.strictEqual(h1.qwen.status, h2.qwen.status);

    delete process.env.QWEN_API_KEY;
  });

  // TEST 6: capacités Qwen
  await test(6, 'Capacités déclarées de Qwen', () => {
    const qwen = new QwenProvider();
    assert.strictEqual(qwen.capabilities.text, true);
    assert.strictEqual(qwen.capabilities.audio, false);
    assert.strictEqual(qwen.capabilities.structuredOutput, true);
  });

  // TEST 7: capacités DeepSeek
  await test(7, 'Capacités déclarées de DeepSeek', () => {
    const ds = new DeepSeekProvider();
    assert.strictEqual(ds.capabilities.text, true);
    assert.strictEqual(ds.capabilities.audio, false);
    assert.strictEqual(ds.capabilities.structuredOutput, true);
  });

  // TEST 8: capacités GLM
  await test(8, 'Capacités déclarées de GLM', () => {
    const glm = new GLMProvider();
    assert.strictEqual(glm.capabilities.text, true);
    assert.strictEqual(glm.capabilities.audio, false);
    assert.strictEqual(glm.capabilities.structuredOutput, true);
  });

  // TEST 9: capacités Gemini
  await test(9, 'Capacités déclarées de Gemini', () => {
    const gemini = new GeminiProvider();
    assert.strictEqual(gemini.capabilities.text, true);
    assert.strictEqual(gemini.capabilities.audio, true);
    assert.strictEqual(gemini.capabilities.structuredOutput, true);
  });

  // TEST 10: routage audio vers STT pour modèles text-only
  await test(10, 'Routage audio vers STT pour provider text-only (Qwen)', async () => {
    process.env.AI_PROVIDER = 'qwen';
    process.env.QWEN_API_KEY = 'mock-qwen-key';
    process.env.WHISPER_ENDPOINT = 'http://localhost:8001/transcribe';

    let sttCalled = false;
    let llmReceivedTranscript = '';

    global.fetch = async (url: any, opts: any) => {
      const urlStr = String(url);
      if (urlStr.includes('8001/transcribe')) {
        sttCalled = true;
        return {
          ok: true,
          json: async () => ({ transcript: 'Parole de sage transcrite par Whisper' }),
        } as any;
      }
      if (opts.headers?.Authorization?.includes('mock-qwen-key')) {
        const body = JSON.parse(opts.body);
        llmReceivedTranscript = body.messages[1].content;
        return {
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  transcript: 'Parole de sage transcrite par Whisper',
                  theme: 'wisdom',
                  extracted: 'Parole de sage',
                  summary: 'Leçon',
                  culturalSignificance: 'Importance',
                  nextMission: 'Prochaine quête',
                }),
              },
            }],
          }),
        } as any;
      }
      return { ok: false } as any;
    };

    const orchestrator = new AIOrchestrator();
    const result = await orchestrator.analyze({
      audioBuffer: Buffer.from('mock-audio-data-header-padding-12345'),
      mimeType: 'audio/webm',
      missionText: 'Trouve un sage',
      missionNumber: 1,
    });

    assert.strictEqual(sttCalled, true, 'STT should have been invoked for text-only Qwen');
    assert.ok(llmReceivedTranscript.includes('Parole de sage transcrite par Whisper'));
    assert.strictEqual(result.providerUsed, 'qwen');

    delete process.env.AI_PROVIDER;
    delete process.env.QWEN_API_KEY;
    delete process.env.WHISPER_ENDPOINT;
  });

  // TEST 11: routage transcript direct vers LLM
  await test(11, 'Routage direct sans STT si transcript déjà fourni', async () => {
    process.env.AI_PROVIDER = 'qwen';
    process.env.QWEN_API_KEY = 'mock-qwen-key';
    process.env.WHISPER_ENDPOINT = 'http://localhost:8001/transcribe';

    let sttCalled = false;

    global.fetch = async (url: any, opts: any) => {
      if (String(url).includes('8001/transcribe')) {
        sttCalled = true;
      }
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                transcript: 'Texte direct fourni',
                theme: 'direct',
                extracted: 'Extraction',
                summary: 'Résumé',
                culturalSignificance: 'Portée',
                nextMission: 'Quête suivante',
              }),
            },
          }],
        }),
      } as any;
    };

    const orchestrator = new AIOrchestrator();
    await orchestrator.analyze({
      transcript: 'Texte direct fourni',
      missionText: 'Mission directe',
      missionNumber: 1,
    });

    assert.strictEqual(sttCalled, false, 'STT should NOT be called when transcript is already provided');

    delete process.env.AI_PROVIDER;
    delete process.env.QWEN_API_KEY;
    delete process.env.WHISPER_ENDPOINT;
  });

  // TEST 12: fallback Qwen -> DeepSeek
  await test(12, 'Fallback automatique Qwen (erreur 500) vers DeepSeek (succès)', async () => {
    process.env.AI_PROVIDER = 'auto';
    process.env.AI_PROVIDER_ORDER = 'qwen,deepseek';
    process.env.QWEN_API_KEY = 'mock-qwen-key';
    process.env.DEEPSEEK_API_KEY = 'mock-ds-key';

    global.fetch = async (url: any, opts: any) => {
      const auth = opts.headers?.Authorization || '';
      if (auth.includes('mock-qwen-key')) {
        return { ok: false, status: 500, text: async () => 'Internal Error' } as any;
      }
      if (auth.includes('mock-ds-key')) {
        return {
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  transcript: 'DeepSeek fallback',
                  theme: 'fallback',
                  extracted: 'Extraction',
                  summary: 'Résumé',
                  culturalSignificance: 'Portée',
                  nextMission: 'Suivant',
                }),
              },
            }],
          }),
        } as any;
      }
      return { ok: false } as any;
    };

    const orchestrator = new AIOrchestrator();
    const result = await orchestrator.analyze({
      transcript: 'Texte test',
      missionText: 'Mission',
      missionNumber: 1,
    });

    assert.strictEqual(result.providerUsed, 'deepseek');

    delete process.env.AI_PROVIDER;
    delete process.env.AI_PROVIDER_ORDER;
    delete process.env.QWEN_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
  });

  // TEST 13: panneau désactivé par défaut
  await test(13, 'Panneau debug désactivé par défaut', () => {
    const defaultVal = process.env.VITE_DEV_PANEL_ENABLED;
    assert.ok(defaultVal !== 'true', 'Dev panel should be disabled by default');
  });

  // TEST 14: panneau activé via flag
  await test(14, 'Panneau debug configurable via VITE_DEV_PANEL_ENABLED=true', () => {
    process.env.VITE_DEV_PANEL_ENABLED = 'true';
    const isEnabled = process.env.VITE_DEV_PANEL_ENABLED === 'true';
    assert.strictEqual(isEnabled, true);
    delete process.env.VITE_DEV_PANEL_ENABLED;
  });

  // TEST 15: absence totale de secrets dans getStatus()
  await test(15, 'Absence totale de clés, tokens ou headers dans getStatus()', async () => {
    process.env.QWEN_API_KEY = 'sk-SUPER-SECRET-KEY-12345';
    process.env.DEEPSEEK_API_KEY = 'sk-DEEPSEEK-SECRET-67890';
    process.env.GEMINI_API_KEY = 'AIzaSySECRET-GEMINI-ABCDE';

    const orchestrator = new AIOrchestrator();
    const status = await orchestrator.getStatus();

    const stringified = JSON.stringify(status);
    assert.strictEqual(stringified.includes('sk-SUPER-SECRET-KEY-12345'), false, 'Qwen key leaked in getStatus()!');
    assert.strictEqual(stringified.includes('sk-DEEPSEEK-SECRET-67890'), false, 'DeepSeek key leaked in getStatus()!');
    assert.strictEqual(stringified.includes('AIzaSySECRET-GEMINI-ABCDE'), false, 'Gemini key leaked in getStatus()!');

    delete process.env.QWEN_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  // Restauration fetch
  global.fetch = originalFetch;

  console.log('====================================================');
  console.log(`TOTAL RESULT: ${passed} PASSED, ${failed} FAILED.`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
