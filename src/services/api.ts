import { AnalyzeResponse, Story } from '../types';

export interface StartMissionResponse {
  sessionId: string;
  missionNumber: number;
  mission: string;
  theme: string;
}

export interface StatsResponse {
  totalStories: number;
}

export async function fetchHealth(): Promise<{ status: string }> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function startMission(sessionId?: string): Promise<StartMissionResponse> {
  const url = sessionId ? `/api/mission/start?sessionId=${encodeURIComponent(sessionId)}` : '/api/mission/start';
  const res = await fetch(url);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to start mission (${res.status})`);
  }
  return res.json();
}

export async function analyzeRecording(formData: FormData): Promise<AnalyzeResponse> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody.error || errorBody.message || `Analysis failed (${res.status})`;
    const error = new Error(message) as Error & { code?: string };
    error.code = errorBody.code || (res.status === 429 ? 'RATE_LIMIT' : 'SERVER_ERROR');
    throw error;
  }

  return res.json();
}

export async function fetchStats(): Promise<StatsResponse> {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchStories(): Promise<{ stories: Story[] }> {
  const res = await fetch('/api/stories');
  if (!res.ok) throw new Error('Failed to fetch stories');
  return res.json();
}
