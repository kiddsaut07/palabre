import assert from 'assert';
import { AIOrchestrator } from '../server/ai/aiOrchestrator';

async function runMockHttpSuite() {
  console.log('--- PALABRE MOCK NETWORK & FALLBACK TEST SUITE ---');
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err: unknown) {
      console.error(`[FAIL] ${name}:`, err);
      failed++;
    }
  }

  // Intercept global fetch for test isolation
  const originalFetch = global.fetch;

  await test('QwenProvider succeeds when OpenAI-compatible endpoint responds with valid JSON', async () => {
    process.env.AI_PROVIDER = 'qwen';
    process.env.QWEN_API_KEY = 'mock-qwen-key';

    global.fetch = async (url: any, opts: any) => {
      assert.ok(opts.headers.Authorization.includes('Bearer mock-qwen-key'));
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  transcript: 'Laisse parler le vent avant de poser la case.',
                  theme: 'craft',
                  extracted: 'Laisse parler le vent',
                  summary: 'Conseil de construction',
                  culturalSignificance: 'Architecture vernaculaire',
                  nextMission: 'Trouve un maçon traditionnel.',
                }),
              },
            },
          ],
        }),
      } as any;
    };

    const orchestrator = new AIOrchestrator();
    const result = await orchestrator.analyze({
      missionText: 'Trouve un bâtisseur',
      missionNumber: 1,
      transcript: 'Laisse parler le vent.',
    });

    assert.strictEqual(result.providerUsed, 'qwen');
    assert.strictEqual(result.theme, 'craft');
    assert.strictEqual(result.nextMission, 'Trouve un maçon traditionnel.');

    delete process.env.AI_PROVIDER;
    delete process.env.QWEN_API_KEY;
  });

  await test('AIOrchestrator falls back from failing Qwen to working DeepSeek in auto mode', async () => {
    process.env.AI_PROVIDER = 'auto';
    process.env.AI_PROVIDER_ORDER = 'qwen,deepseek';
    process.env.QWEN_API_KEY = 'mock-qwen-key';
    process.env.DEEPSEEK_API_KEY = 'mock-ds-key';

    global.fetch = async (url: any, opts: any) => {
      const auth = opts.headers.Authorization || '';
      if (auth.includes('mock-qwen-key')) {
        // Qwen fails with 500
        return {
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error on Qwen',
        } as any;
      }
      if (auth.includes('mock-ds-key')) {
        // DeepSeek succeeds
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    transcript: 'DeepSeek parsed transcript.',
                    theme: 'memory',
                    extracted: 'Sagesse préservée',
                    summary: 'Résumé DeepSeek',
                    culturalSignificance: 'Mémoire locale',
                    nextMission: 'Prochaine quête DeepSeek.',
                  }),
                },
              },
            ],
          }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    };

    const orchestrator = new AIOrchestrator();
    const result = await orchestrator.analyze({
      missionText: 'Mission de test',
      missionNumber: 1,
      transcript: 'Test speech transcript',
    });

    assert.strictEqual(result.providerUsed, 'deepseek');
    assert.strictEqual(result.theme, 'memory');

    delete process.env.AI_PROVIDER;
    delete process.env.AI_PROVIDER_ORDER;
    delete process.env.QWEN_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
  });

  // Restore global fetch
  global.fetch = originalFetch;

  console.log(`\nMock tests: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runMockHttpSuite().catch((err) => {
  console.error('Fatal mock test error:', err);
  process.exit(1);
});
