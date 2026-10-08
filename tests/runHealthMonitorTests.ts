import assert from 'assert';
import { HealthMonitor } from '../server/ai/healthMonitor';
import { AIOrchestrator } from '../server/ai/aiOrchestrator';

async function runTestSuite() {
  console.log('====================================================');
  console.log('PALABRE: AUTOMATED HEALTH MONITOR TEST SUITE');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err: unknown) {
      console.error(`[FAIL] ${name}:`, err);
      failed++;
    }
  }

  const originalFetch = global.fetch;

  // 1. Monitor initialization
  await test('HealthMonitor initializes with interval and stopped state', () => {
    const monitor = new HealthMonitor(45000);
    const status = monitor.getStatus();
    assert.strictEqual(status.isRunning, false);
    assert.strictEqual(status.intervalMs, 45000);
  });

  // 2. Start and Stop
  await test('HealthMonitor start() and stop() control lifecycle cleanly', () => {
    const monitor = new HealthMonitor(60000);
    monitor.start();
    assert.strictEqual(monitor.getStatus().isRunning, true);
    monitor.stop();
    assert.strictEqual(monitor.getStatus().isRunning, false);
  });

  // 3. runCheck() records statistics
  await test('runCheck() records health stats for providers', async () => {
    process.env.QWEN_API_KEY = 'mock-qwen-key';
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'pong' } }] }),
    } as any);

    const monitor = new HealthMonitor();
    const stats = await monitor.runCheck();

    const qwenStats = stats.get('qwen');
    assert.ok(qwenStats, 'Qwen stats should exist');
    assert.strictEqual(qwenStats.configured, true);
    assert.strictEqual(qwenStats.healthy, true);
    assert.strictEqual(qwenStats.consecutiveFailures, 0);
    assert.strictEqual(qwenStats.successfulChecks, 1);
    assert.strictEqual(qwenStats.uptimePercentage, 100);

    const deepseekStats = stats.get('deepseek');
    assert.ok(deepseekStats, 'DeepSeek stats should exist');
    assert.strictEqual(deepseekStats.configured, false);
    assert.strictEqual(deepseekStats.healthy, false);

    delete process.env.QWEN_API_KEY;
  });

  // 4. Consecutive failures and recovery tracking
  await test('HealthMonitor tracks consecutive failures on error and resets on recovery', async () => {
    process.env.DEEPSEEK_API_KEY = 'mock-ds-key';

    const monitor = new HealthMonitor();

    // Check 1: Fails with 503
    global.fetch = async () => ({
      ok: false,
      status: 503,
      text: async () => 'Unavailable',
    } as any);

    await monitor.runCheck();
    let dsStats = monitor.getStats().deepseek;
    assert.strictEqual(dsStats.healthy, false);
    assert.strictEqual(dsStats.consecutiveFailures, 1);

    // Check 2: Recovers with 200
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    } as any);

    await monitor.runCheck();
    dsStats = monitor.getStats().deepseek;
    assert.strictEqual(dsStats.healthy, true);
    assert.strictEqual(dsStats.consecutiveFailures, 0);
    assert.strictEqual(dsStats.totalChecks, 2);
    assert.strictEqual(dsStats.successfulChecks, 1);
    assert.strictEqual(dsStats.uptimePercentage, 50);

    delete process.env.DEEPSEEK_API_KEY;
  });

  // 5. Intelligent candidate prioritization based on monitor health
  await test('AIOrchestrator prioritizes verified healthy provider over failing one', async () => {
    process.env.AI_PROVIDER = 'auto';
    process.env.AI_PROVIDER_ORDER = 'qwen,deepseek';
    process.env.QWEN_API_KEY = 'mock-qwen-key';
    process.env.DEEPSEEK_API_KEY = 'mock-ds-key';

    const orchestrator = new AIOrchestrator();

    // Hook a monitor state where DeepSeek is verified healthy and Qwen is failing
    orchestrator.setMonitor({
      isProviderHealthy: (name: string) => name === 'deepseek',
      getStatus: () => ({ isRunning: true, intervalMs: 60000, stats: {} }),
    });

    let firstCalled = '';
    global.fetch = async (url: any, opts: any) => {
      const auth = opts.headers?.Authorization || '';
      if (!firstCalled) {
        firstCalled = auth.includes('mock-ds-key') ? 'deepseek' : 'qwen';
      }
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                transcript: 'Prioritized healthy provider test',
                theme: 'reliability',
                extracted: 'Sagesse',
                summary: 'Résumé',
                culturalSignificance: 'Portée',
                nextMission: 'Mission',
              }),
            },
          }],
        }),
      } as any;
    };

    const result = await orchestrator.analyze({
      transcript: 'Test transcription',
      missionText: 'Trouve un sage',
      missionNumber: 1,
    });

    assert.strictEqual(firstCalled, 'deepseek', 'DeepSeek should be called first because monitor flagged it healthy');
    assert.strictEqual(result.providerUsed, 'deepseek');

    delete process.env.AI_PROVIDER;
    delete process.env.AI_PROVIDER_ORDER;
    delete process.env.QWEN_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
  });

  // Restore fetch
  global.fetch = originalFetch;

  console.log('====================================================');
  console.log(`TOTAL RESULT: ${passed} PASSED, ${failed} FAILED.`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

runTestSuite().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
