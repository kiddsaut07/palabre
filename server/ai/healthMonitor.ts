import { aiOrchestrator } from './aiOrchestrator';
import { ProviderHealth, HealthStatusType } from './types';

export interface ProviderHealthStats {
  provider: string;
  configured: boolean;
  healthy: boolean;
  status: HealthStatusType;
  latencyMs?: number;
  lastCheckedAt: string;
  lastHealthyAt?: string;
  consecutiveFailures: number;
  totalChecks: number;
  successfulChecks: number;
  uptimePercentage: number;
  lastError?: string | null;
}

export class HealthMonitor {
  private timer: NodeJS.Timeout | null = null;
  private startupTimeout: NodeJS.Timeout | null = null;
  private intervalMs: number;
  private isRunning = false;
  private stats: Map<string, ProviderHealthStats> = new Map();

  constructor(intervalMs = 60000) {
    this.intervalMs = parseInt(
      process.env.HEALTH_CHECK_INTERVAL_MS || `${intervalMs}`,
      10
    );
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[HealthMonitor] Started automated health checking (interval: ${this.intervalMs / 1000}s)`);

    // Run first check after a brief startup delay (2s)
    this.startupTimeout = setTimeout(() => {
      this.runCheck().catch((err) =>
        console.warn('[HealthMonitor] Initial check error:', err)
      );
    }, 2000);
    if (this.startupTimeout.unref) this.startupTimeout.unref();

    this.timer = setInterval(() => {
      this.runCheck().catch((err) =>
        console.warn('[HealthMonitor] Scheduled check error:', err)
      );
    }, this.intervalMs);

    // Ensure timer doesn't prevent Node process from exiting
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  public stop(): void {
    if (this.startupTimeout) {
      clearTimeout(this.startupTimeout);
      this.startupTimeout = null;
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[HealthMonitor] Stopped automated health checking.');
  }

  public async runCheck(): Promise<Map<string, ProviderHealthStats>> {
    // Run health check on orchestrator with force=true to bypass cache
    const healthMap = await aiOrchestrator.getHealth(true);
    const now = new Date().toISOString();

    for (const [providerName, health] of Object.entries(healthMap)) {
      const current = this.stats.get(providerName) || {
        provider: providerName,
        configured: health.configured,
        healthy: health.healthy,
        status: health.status,
        lastCheckedAt: now,
        consecutiveFailures: 0,
        totalChecks: 0,
        successfulChecks: 0,
        uptimePercentage: 100,
      };

      current.configured = health.configured;
      current.status = health.status;
      current.latencyMs = health.latencyMs;
      current.lastCheckedAt = now;

      // Only track checks for configured providers to keep stats meaningful
      if (health.configured) {
        current.totalChecks += 1;

        const previousHealthy = current.healthy;
        current.healthy = health.healthy;

        if (health.healthy) {
          current.successfulChecks += 1;
          current.consecutiveFailures = 0;
          current.lastHealthyAt = now;
          current.lastError = null;

          if (!previousHealthy && current.totalChecks > 1) {
            console.log(`[HealthMonitor] Provider "${providerName}" RECOVERED -> HEALTHY (latency: ${health.latencyMs || 0}ms)`);
          }
        } else {
          current.consecutiveFailures += 1;
          current.lastError = health.error || 'Check failed';

          if (previousHealthy || current.consecutiveFailures === 1) {
            console.warn(
              `[HealthMonitor] Provider "${providerName}" UNHEALTHY -> ${health.status} (${current.lastError})`
            );
          }
        }

        current.uptimePercentage = Math.round(
          (current.successfulChecks / current.totalChecks) * 100
        );
      } else {
        current.healthy = false;
      }

      this.stats.set(providerName, current);
    }

    return this.stats;
  }

  public isProviderHealthy(providerName: string): boolean {
    const s = this.stats.get(providerName.toLowerCase());
    if (!s) return false;
    return s.configured && s.healthy && s.consecutiveFailures === 0;
  }

  public getStats(): Record<string, ProviderHealthStats> {
    const record: Record<string, ProviderHealthStats> = {};
    for (const [name, stat] of this.stats.entries()) {
      record[name] = { ...stat };
    }
    return record;
  }

  public getStatus(): { isRunning: boolean; intervalMs: number; stats: Record<string, ProviderHealthStats> } {
    return {
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
      stats: this.getStats(),
    };
  }
}

export const healthMonitor = new HealthMonitor();

// Register monitor hook into the orchestrator
aiOrchestrator.setMonitor({
  isProviderHealthy: (name: string) => healthMonitor.isProviderHealthy(name),
  getStatus: () => healthMonitor.getStatus(),
});
