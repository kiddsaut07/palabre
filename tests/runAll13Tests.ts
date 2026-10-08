import assert from 'assert';
import { QwenProvider } from '../server/ai/providers/qwenProvider';
import { DeepSeekProvider } from '../server/ai/providers/deepseekProvider';
import { GLMProvider } from '../server/ai/providers/glmProvider';
import { GeminiProvider } from '../server/ai/providers/geminiProvider';
import { AIOrchestrator } from '../server/ai/aiOrchestrator';
import { sanitizeAndValidateAIOutput, buildPromptText } from '../server/ai/commonPrompt';

async function main() {
  console.log('==============================================');
  console.log('PALABRE: EXECUTION OF THE 13 MANDATORY AI TESTS');
  console.log('==============================================');

  let passedCount = 0;
  let failedCount = 0;

  async function runTest(num: number, title: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`[PASS] TEST ${num}: ${title}`);
      passedCount++;
    } catch (err: unknown) {
      console.error(`[FAIL] TEST ${num}: ${title}`);
      console.error('      Reason:', err instanceof Error ? err.message : err);
      failedCount++;
    }
  }

  const originalFetch = global.fetch;

  // TEST 1: Qwen configuré
  await runTest(1, 'Qwen configuré', () => {
    process.env.QWEN_API_KEY = 'test-qwen-key-12345';
    process.env.QWEN_MODEL = 'qwen2.5-72b-instruct';
    const qwen = new QwenProvider();
    assert.strictEqual(qwen.name, 'qwen');
    assert.strictEqual(qwen.isConfigured(), true);
    delete process.env.QWEN_API_KEY;
    delete process.env.QWEN_MODEL;
  });

  // TEST 2: Qwen non configuré
  await runTest(2, 'Qwen non configuré', () => {
    delete process.env.QWEN_API_KEY;
    const qwen = new QwenProvider();
    assert.strictEqual(qwen.name, 'qwen');
    assert.strictEqual(qwen.isConfigured(), false);
  });

  // TEST 3: AI_PROVIDER=qwen
  await runTest(3, 'AI_PROVIDER=qwen cible exclusivement Qwen et rejette si clé absente', async () => {
    process.env.AI_PROVIDER = 'qwen';
    delete process.env.QWEN_API_KEY;
    const orchestrator = new AIOrchestrator();
    await assert.rejects(
      async () => {
        await orchestrator.analyze({
          missionText: 'Trouve un sage.',
          missionNumber: 1,
          transcript: 'La sagesse commence par le silence.',
        });
      },
      /Provider "qwen" is requested, but its API key is not configured/
    );
    delete process.env.AI_PROVIDER;
  });

  // TEST 4: AI_PROVIDER=auto
  await runTest(4, 'AI_PROVIDER=auto sélectionne les providers configurés selon l\'ordre défini', async () => {
    process.env.AI_PROVIDER = 'auto';
    process.env.AI_PROVIDER_ORDER = 'qwen,deepseek,glm,gemini';
    const orchestrator = new AIOrchestrator();
    const status = await orchestrator.getStatus();
    assert.strictEqual(status.mode, 'auto');
    assert.deepStrictEqual(status.fallbackOrder, ['qwen', 'deepseek', 'glm', 'gemini']);
    delete process.env.AI_PROVIDER;
    delete process.env.AI_PROVIDER_ORDER;
  });

  // TEST 5: Qwen succès → aucun fallback
  await runTest(5, 'Qwen succès → arrêt immédiat sans appeler DeepSeek', async () => {
    process.env.AI_PROVIDER = 'auto';
    process.env.AI_PROVIDER_ORDER = 'qwen,deepseek';
    process.env.QWEN_API_KEY = 'mock-qwen-key';
    process.env.DEEPSEEK_API_KEY = 'mock-ds-key';

    let qwenCalled = false;
    let deepseekCalled = false;

    global.fetch = async (url: any, opts: any) => {
      const auth = opts.headers?.Authorization || '';
      if (auth.includes('mock-qwen-key')) {
        qwenCalled = true;
        return {
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  transcript: 'Mon grand-père me disait toujours qu\'avant de chercher à gagner rapidement, il fallait d\'abord apprendre à connaître les gens.',
                  theme: 'patience',
                  extracted: 'Apprendre à connaître les gens avant de chercher à gagner',
                  summary: 'Transmission familiale sur les relations humaines et la patience.',
                  culturalSignificance: 'Ancrage dans les valeurs de respect communautaire.',
                  nextMission: 'Trouve quelqu\'un qui habite le quartier depuis plus de 20 ans et demande-lui ce qui unit les voisins.',
                }),
              },
            }],
          }),
        } as any;
      }
      if (auth.includes('mock-ds-key')) {
        deepseekCalled = true;
        return { ok: true, json: async () => ({}) } as any;
      }
      return { ok: false, status: 404 } as any;
    };

    const orchestrator = new AIOrchestrator();
    const result = await orchestrator.analyze({
      missionText: 'Trouve un aîné du quartier.',
      missionNumber: 1,
      transcript: 'Mon grand-père me disait toujours...',
    });

    assert.strictEqual(qwenCalled, true);
    assert.strictEqual(deepseekCalled, false); // N'a PAS appelé DeepSeek
    assert.strictEqual(result.providerUsed, 'qwen');
    assert.strictEqual(result.theme, 'patience');

    delete process.env.AI_PROVIDER;
    delete process.env.AI_PROVIDER_ORDER;
    delete process.env.QWEN_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
  });

  // TEST 6: Qwen HTTP 500 → DeepSeek
  await runTest(6, 'Qwen HTTP 500 → repli automatique vers DeepSeek', async () => {
    process.env.AI_PROVIDER = 'auto';
    process.env.AI_PROVIDER_ORDER = 'qwen,deepseek';
    process.env.QWEN_API_KEY = 'mock-qwen-key';
    process.env.DEEPSEEK_API_KEY = 'mock-ds-key';

    global.fetch = async (url: any, opts: any) => {
      const auth = opts.headers?.Authorization || '';
      if (auth.includes('mock-qwen-key')) {
        return { ok: false, status: 500, text: async () => 'Internal Server Error' } as any;
      }
      if (auth.includes('mock-ds-key')) {
        return {
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  transcript: 'Réponse DeepSeek après échec Qwen',
                  theme: 'resilience',
                  extracted: 'La persévérance',
                  summary: 'Leçon de courage',
                  culturalSignificance: 'Mémoire urbaine',
                  nextMission: 'Trouve un artisan.',
                }),
              },
            }],
          }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    };

    const orchestrator = new AIOrchestrator();
    const result = await orchestrator.analyze({
      missionText: 'Mission de test',
      missionNumber: 1,
      transcript: 'Texte témoin',
    });

    assert.strictEqual(result.providerUsed, 'deepseek');
    assert.strictEqual(result.theme, 'resilience');

    delete process.env.AI_PROVIDER;
    delete process.env.AI_PROVIDER_ORDER;
    delete process.env.QWEN_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
  });

  // TEST 7: Qwen timeout → DeepSeek
  await runTest(7, 'Qwen timeout → repli automatique vers DeepSeek', async () => {
    process.env.AI_PROVIDER = 'auto';
    process.env.AI_PROVIDER_ORDER = 'qwen,deepseek';
    process.env.QWEN_API_KEY = 'mock-qwen-key';
    process.env.DEEPSEEK_API_KEY = 'mock-ds-key';

    global.fetch = async (url: any, opts: any) => {
      const auth = opts.headers?.Authorization || '';
      if (auth.includes('mock-qwen-key')) {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      }
      if (auth.includes('mock-ds-key')) {
        return {
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  transcript: 'DeepSeek après timeout Qwen',
                  theme: 'sagesse',
                  extracted: 'Écoute active',
                  summary: 'Résumé',
                  culturalSignificance: 'Signification',
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
      missionText: 'Test timeout',
      missionNumber: 1,
      transcript: 'Texte témoin',
    });

    assert.strictEqual(result.providerUsed, 'deepseek');

    delete process.env.AI_PROVIDER;
    delete process.env.AI_PROVIDER_ORDER;
    delete process.env.QWEN_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
  });

  // TEST 8: Qwen JSON invalide → DeepSeek
  await runTest(8, 'Qwen JSON invalide → repli automatique vers DeepSeek', async () => {
    process.env.AI_PROVIDER = 'auto';
    process.env.AI_PROVIDER_ORDER = 'qwen,deepseek';
    process.env.QWEN_API_KEY = 'mock-qwen-key';
    process.env.DEEPSEEK_API_KEY = 'mock-ds-key';

    global.fetch = async (url: any, opts: any) => {
      const auth = opts.headers?.Authorization || '';
      if (auth.includes('mock-qwen-key')) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Ceci n\'est absolument pas du JSON {corrompu}' } }],
          }),
        } as any;
      }
      if (auth.includes('mock-ds-key')) {
        return {
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  transcript: 'DeepSeek après JSON invalide',
                  theme: 'mémoire',
                  extracted: 'Transmission',
                  summary: 'Résumé',
                  culturalSignificance: 'Signification',
                  nextMission: 'Quête suivante',
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
      missionText: 'Test JSON corrompu',
      missionNumber: 1,
      transcript: 'Texte témoin',
    });

    assert.strictEqual(result.providerUsed, 'deepseek');

    delete process.env.AI_PROVIDER;
    delete process.env.AI_PROVIDER_ORDER;
    delete process.env.QWEN_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
  });

  // TEST 9: Tous les providers échouent
  await runTest(9, 'Tous les providers configurés échouent → erreur explicite renvoyée', async () => {
    process.env.AI_PROVIDER = 'auto';
    process.env.AI_PROVIDER_ORDER = 'qwen';
    process.env.QWEN_API_KEY = 'mock-qwen-key';
    delete process.env.DEMO_MODE;

    global.fetch = async () => {
      return { ok: false, status: 503, text: async () => 'Service Unavailable' } as any;
    };

    const orchestrator = new AIOrchestrator();
    await assert.rejects(
      async () => {
        await orchestrator.analyze({
          missionText: 'Test total failure',
          missionNumber: 1,
          transcript: 'Texte témoin',
        });
      },
      /All configured AI providers failed/
    );

    delete process.env.AI_PROVIDER;
    delete process.env.AI_PROVIDER_ORDER;
    delete process.env.QWEN_API_KEY;
  });

  // TEST 10: Gemini absent mais Qwen disponible
  await runTest(10, 'Gemini absent mais Qwen disponible → fonctionne sans aucune erreur', async () => {
    delete process.env.GEMINI_API_KEY;
    process.env.AI_PROVIDER = 'auto';
    process.env.AI_PROVIDER_ORDER = 'qwen';
    process.env.QWEN_API_KEY = 'mock-qwen-key';

    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              transcript: 'Qwen sans Gemini',
              theme: 'autonomie',
              extracted: 'Indépendance',
              summary: 'Fonctionnement autonome',
              culturalSignificance: 'Signification',
              nextMission: 'Parle à un artisan.',
            }),
          },
        }],
      }),
    } as any);

    const orchestrator = new AIOrchestrator();
    const result = await orchestrator.analyze({
      missionText: 'Test sans Gemini',
      missionNumber: 1,
      transcript: 'Texte autonome',
    });

    assert.strictEqual(result.providerUsed, 'qwen');
    assert.strictEqual(result.theme, 'autonomie');

    delete process.env.AI_PROVIDER;
    delete process.env.AI_PROVIDER_ORDER;
    delete process.env.QWEN_API_KEY;
  });

  // TEST 11: Contrat AIAnalysisResult valide
  await runTest(11, 'Contrat AIAnalysisResult rigoureusement respecté', () => {
    const raw = JSON.stringify({
      transcript: 'Témoignage recueilli',
      theme: 'Wisdom',
      extracted: 'Proverbe de famille',
      summary: 'Résumé concis en deux phrases.',
      culturalSignificance: 'Portée culturelle pour le quartier.',
      nextMission: 'Trouve quelqu\'un qui travaille de ses mains.',
    });
    const parsed = sanitizeAndValidateAIOutput(raw, 'Mission fallback');
    assert.strictEqual(typeof parsed.transcript, 'string');
    assert.strictEqual(typeof parsed.theme, 'string');
    assert.strictEqual(typeof parsed.extracted, 'string');
    assert.strictEqual(typeof parsed.summary, 'string');
    assert.strictEqual(typeof parsed.culturalSignificance, 'string');
    assert.strictEqual(typeof parsed.nextMission, 'string');
  });

  // TEST 12: Réponse JSON corrompue rejetée
  await runTest(12, 'Réponse JSON corrompue rejetée proprement', () => {
    assert.throws(() => {
      sanitizeAndValidateAIOutput('Internal error: not a json response', 'Mission fallback');
    }, /Failed to parse LLM JSON output/);
  });

  // TEST 13: Aucune API key présente dans les logs
  await runTest(13, 'Aucune API key ni token présent dans les logs d\'erreur', async () => {
    const secretKey = 'sk-SECRET-998877665544332211';
    process.env.QWEN_API_KEY = secretKey;

    let capturedLog = '';
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      capturedLog += args.join(' ');
      originalWarn(...args);
    };

    global.fetch = async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: 'Invalid authentication key' } }),
    } as any);

    const qwen = new QwenProvider();
    try {
      await qwen.analyze({
        missionText: 'Secret test',
        missionNumber: 1,
        transcript: 'Secret test transcript',
      });
    } catch (err: unknown) {
      const errMessage = (err as Error).message;
      assert.strictEqual(errMessage.includes(secretKey), false, 'API key leak detected in error message!');
    } finally {
      console.warn = originalWarn;
      delete process.env.QWEN_API_KEY;
    }

    assert.strictEqual(capturedLog.includes(secretKey), false, 'API key leak detected in console logs!');
  });

  // Restore fetch
  global.fetch = originalFetch;

  console.log('==============================================');
  console.log(`TOTAL RESULT: ${passedCount} PASSED, ${failedCount} FAILED.`);
  console.log('==============================================');

  if (failedCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
