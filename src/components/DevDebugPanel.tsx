import React, { useState, useEffect } from 'react';
import { Terminal, X, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Cpu, Activity, Clock } from 'lucide-react';

interface HealthData {
  status: string;
  timestamp: string;
  demoMode: boolean;
  ai: {
    mode: string;
    activeProvider: string;
    configuredProviders: Record<string, boolean>;
    fallbackOrder: string[];
    capabilities: Record<string, { text: boolean; audio: boolean; structuredOutput: boolean; transcription?: boolean }>;
    health: Record<string, {
      provider: string;
      configured: boolean;
      reachable: boolean;
      healthy: boolean;
      latencyMs?: number;
      status: string;
      error?: string | null;
      lastCheckedAt: string;
    }>;
    lastMetrics?: {
      timestamp: string;
      inputMode: 'audio' | 'text';
      sttProvider?: string;
      sttLatencyMs?: number;
      llmProvider: string;
      llmLatencyMs: number;
      totalLatencyMs: number;
      fallbacksCount: number;
      status: 'success' | 'error';
    } | null;
  };
}

export const DevDebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if panel is enabled via environment variable, URL search param ?debug=ai or #dev-ai
  const isEnabled =
    import.meta.env.VITE_DEV_PANEL_ENABLED === 'true' ||
    (typeof window !== 'undefined' && (window.location.search.includes('debug=ai') || window.location.hash === '#dev-ai'));

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.warn('[DebugPanel] Failed to fetch health:', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerImmediateCheck = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health/check', { method: 'POST' });
      if (res.ok) {
        await fetchStatus();
      }
    } catch (err) {
      console.warn('[DebugPanel] Immediate check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isEnabled && isOpen) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 15000); // 15s refresh when open
      return () => clearInterval(interval);
    }
  }, [isEnabled, isOpen]);

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      {/* Floating Toggle Icon (visible only when DEV_PANEL_ENABLED=true or ?debug=ai) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-3 right-3 z-50 bg-[#171514] hover:bg-[#242220] text-[#FF6B35] border border-[#2B2825] px-2.5 py-1.5 rounded-md font-mono text-[11px] flex items-center gap-1.5 shadow-xl cursor-pointer transition-colors"
          title="Open PALABRE AI Debug Panel"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>AI Debug</span>
        </button>
      )}

      {/* Modal Inspector Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end p-2 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[#0D0D0D] border border-[#262220] rounded-xl shadow-2xl flex flex-col overflow-hidden text-[#F2EEE8] font-mono text-xs">
            {/* Header */}
            <div className="p-3.5 border-b border-[#1C1A18] flex items-center justify-between bg-[#141414]">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#FF6B35]" />
                <span className="font-bold text-sm tracking-wide text-[#F2EEE8]">PALABRE AI DEBUG</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchStatus}
                  disabled={loading}
                  className="p-1 text-[#77736D] hover:text-[#F2EEE8] rounded cursor-pointer transition-colors"
                  title="Refresh status"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-[#77736D] hover:text-[#F2EEE8] rounded cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {/* Active Provider */}
              <div className="bg-[#141414] border border-[#242220] rounded-lg p-3">
                <div className="text-[10px] uppercase text-[#77736D] tracking-wider mb-1 flex items-center justify-between">
                  <span>Active Provider</span>
                  <span className="text-[#FF6B35]">Mode: {data?.ai?.mode || 'auto'}</span>
                </div>
                <div className="text-base font-bold text-[#F2EEE8] uppercase tracking-wide flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#FF6B35]" />
                  <span>{data?.ai?.activeProvider || 'Loading...'}</span>
                </div>
                <div className="text-[10px] text-[#77736D] mt-1">
                  Cascade order: {data?.ai?.fallbackOrder?.join(' → ') || 'none'}
                </div>
              </div>

              {/* Provider Health Check */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase text-[#77736D] tracking-wider flex items-center justify-between">
                  <span>Provider Health</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={triggerImmediateCheck}
                      disabled={loading}
                      className="text-[9px] text-[#FF6B35] hover:underline cursor-pointer flex items-center gap-1"
                      title="Trigger immediate live verification"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${loading ? 'animate-spin' : ''}`} />
                      <span>Check now</span>
                    </button>
                    <span className="text-[9px] text-[#55524E]">Cached (30s TTL)</span>
                  </div>
                </div>
                <div className="bg-[#141414] border border-[#242220] rounded-lg divide-y divide-[#1C1A18]">
                  {data?.ai?.health &&
                    Object.entries(data.ai.health).map(([name, h]) => (
                      <div key={name} className="p-2.5 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          {h.healthy ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : h.configured ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-[#55524E]" />
                          )}
                          <span className="font-semibold uppercase">{name}</span>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${
                              h.healthy
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                                : h.configured
                                ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                                : 'bg-[#1C1A18] text-[#77736D]'
                            }`}
                          >
                            {h.status}
                          </span>
                          {h.latencyMs !== undefined && h.latencyMs > 0 && (
                            <span className="text-[10px] text-[#77736D] ml-1.5">{h.latencyMs}ms</span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Declared Capabilities */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase text-[#77736D] tracking-wider">
                  Declared Capabilities
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  {data?.ai?.capabilities &&
                    Object.entries(data.ai.capabilities).map(([name, cap]) => (
                      <div key={name} className="bg-[#141414] border border-[#242220] p-2 rounded">
                        <div className="font-bold text-[#F2EEE8] uppercase mb-1">{name}</div>
                        <div className="text-[#A39E96] space-y-0.5">
                          <div className="flex justify-between">
                            <span>Text:</span>
                            <span className={cap.text ? 'text-emerald-400' : 'text-[#55524E]'}>
                              {cap.text ? '✓' : '✗'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Audio:</span>
                            <span className={cap.audio ? 'text-emerald-400' : 'text-[#55524E]'}>
                              {cap.audio ? '✓' : '✗'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>JSON:</span>
                            <span className={cap.structuredOutput ? 'text-emerald-400' : 'text-[#55524E]'}>
                              {cap.structuredOutput ? '✓' : '✗'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Last Request Metrics */}
              {data?.ai?.lastMetrics && (
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase text-[#77736D] tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-[#FF6B35]" />
                    <span>Last Request Metrics</span>
                  </div>
                  <div className="bg-[#141414] border border-[#242220] rounded-lg p-3 space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[#77736D]">Provider:</span>
                      <span className="font-bold uppercase text-[#FF6B35]">
                        {data.ai.lastMetrics.llmProvider}
                      </span>
                    </div>
                    {data.ai.lastMetrics.sttProvider && (
                      <div className="flex justify-between">
                        <span className="text-[#77736D]">STT Provider:</span>
                        <span>{data.ai.lastMetrics.sttProvider} ({data.ai.lastMetrics.sttLatencyMs || 0}ms)</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[#77736D]">LLM Latency:</span>
                      <span>{data.ai.lastMetrics.llmLatencyMs}ms</span>
                    </div>
                    <div className="flex justify-between border-t border-[#1C1A18] pt-1 font-semibold">
                      <span className="text-[#77736D]">Total Duration:</span>
                      <span>{data.ai.lastMetrics.totalLatencyMs}ms</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-[#77736D]">
                      <span>Fallbacks:</span>
                      <span>{data.ai.lastMetrics.fallbacksCount}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Notice */}
            <div className="p-2.5 bg-[#141414] border-t border-[#1C1A18] text-[10px] text-[#77736D] text-center">
              Zero secrets exposed • Developer diagnostics only
            </div>
          </div>
        </div>
      )}
    </>
  );
};
