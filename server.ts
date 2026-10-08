import express, { Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { analyzeAudioRecording, aiOrchestrator } from './server/aiService';
import { healthMonitor } from './server/ai/healthMonitor';
import { storyStorage } from './server/storage';
import { STARTER_QUESTS } from './src/data/starterQuests';
import { Story } from './src/types';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Basic middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup Multer for in-memory audio buffering
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max
  },
  fileFilter: (_req, file, cb) => {
    // Accept audio formats: webm, mp4, ogg, wav, m4a, aac, etc.
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm' || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`));
    }
  },
});

// Simple in-memory rate limiter per IP / session
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();

// Persistent storage for original voice recordings (the oral archive keeps the voice)
const AUDIO_DIR = path.resolve(process.cwd(), 'data', 'audio');
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}
app.use('/audio', express.static(AUDIO_DIR, { maxAge: '7d', immutable: true }));

function audioExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'audio/webm': 'webm',
    'video/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/wave': 'wav',
    'audio/x-wav': 'wav',
    'audio/ogg': 'ogg',
  };
  const ext = map[(mimeType || '').split(';')[0].trim().toLowerCase()];
  return ext || 'webm';
}

function checkRateLimit(key: string, limit = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || record.expiresAt < now) {
    rateLimitMap.set(key, { count: 1, expiresAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count += 1;
  return true;
}

// ==========================================
// API ENDPOINTS
// ==========================================

// GET /api/health
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const orchestratorStatus = await aiOrchestrator.getStatus(false);
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      demoMode: process.env.DEMO_MODE === 'true',
      ai: orchestratorStatus,
    });
  } catch (err: unknown) {
    res.status(500).json({
      status: 'error',
      error: err instanceof Error ? err.message : 'Health check failed',
    });
  }
});

// GET /api/ai/capabilities
app.get('/api/ai/capabilities', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    capabilities: aiOrchestrator.getCapabilities(),
  });
});

// GET /api/health/monitor
app.get('/api/health/monitor', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    monitor: healthMonitor.getStatus(),
  });
});

// POST /api/health/check (triggers immediate health verification)
app.post('/api/health/check', async (_req: Request, res: Response) => {
  try {
    await healthMonitor.runCheck();
    res.json({
      status: 'ok',
      monitor: healthMonitor.getStatus(),
    });
  } catch (err: unknown) {
    res.status(500).json({
      status: 'error',
      error: err instanceof Error ? err.message : 'Check failed',
    });
  }
});

// GET /api/mission/start
app.get('/api/mission/start', (req: Request, res: Response) => {
  try {
    let sessionId = req.query.sessionId as string;
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 5) {
      sessionId = crypto.randomUUID();
    }

    // Pick a starter quest
    const questIndex = Math.floor(Math.random() * STARTER_QUESTS.length);
    const starter = STARTER_QUESTS[questIndex];

    res.json({
      sessionId,
      missionNumber: 1,
      mission: starter.missionText,
      theme: starter.theme,
    });
  } catch (err) {
    console.error('Error starting mission:', err);
    res.status(500).json({ error: 'Internal server error starting mission' });
  }
});

// POST /api/analyze
app.post('/api/analyze', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const sessionId = (req.body.sessionId || '').toString().trim();

    // Check rate limit
    if (!checkRateLimit(`analyze-${sessionId || ip}`, 10, 60000)) {
      res.status(429).json({
        error: 'Too many requests. Please wait a moment before submitting another recording.',
        code: 'RATE_LIMIT',
      });
      return;
    }

    // Validation: Support either audio recording or direct transcript text
    const directTranscript = (req.body.transcript || req.body.text || '').toString().trim();
    const hasAudio = Boolean(req.file && req.file.buffer && req.file.buffer.length >= 500);

    if (!hasAudio && !directTranscript) {
      res.status(400).json({
        error: 'Input missing. Please submit either an audio recording or a transcript.',
        code: 'AUDIO_TOO_SHORT',
      });
      return;
    }

    const missionText = (req.body.missionText || '').toString().trim();
    if (!missionText) {
      res.status(400).json({
        error: 'Missing quest mission context.',
        code: 'INVALID_REQUEST',
      });
      return;
    }

    const rawMissionNumber = parseInt(req.body.missionNumber, 10);
    const missionNumber = isNaN(rawMissionNumber) || rawMissionNumber < 1 ? 1 : rawMissionNumber;
    const audioDurationSec = parseFloat(req.body.audioDurationSec || '0');
    const userId = req.body.userId ? req.body.userId.toString() : undefined;

    // Optional field proof: time outside + distance walked (best-effort, from client)
    const rawDurationOutside = parseFloat(req.body.outdoorDurationSec || '');
    const outdoorDurationSec =
      Number.isFinite(rawDurationOutside) && rawDurationOutside >= 0 ? rawDurationOutside : undefined;
    const rawDistance = parseFloat(req.body.distanceMeters || '');
    const outdoorDistanceM =
      Number.isFinite(rawDistance) && rawDistance >= 0 ? rawDistance : undefined;

    // AI Analysis via Multi-Provider Orchestrator (Ollama / Qwen / DeepSeek / GLM / Gemini)
    const analysis = await analyzeAudioRecording({
      audioBuffer: hasAudio ? req.file!.buffer : undefined,
      mimeType: hasAudio ? (req.file!.mimetype || 'audio/webm') : undefined,
      transcript: directTranscript || undefined,
      missionText,
      missionNumber,
      previousContext: req.body.previousContext ? req.body.previousContext.toString() : undefined,
    });

    // Persist the original voice recording so the archive keeps the actual voice
    let audioUrl: string | undefined;
    if (hasAudio) {
      const fileName = `${crypto.randomUUID()}.${audioExtension(req.file!.mimetype)}`;
      try {
        await fs.promises.writeFile(path.join(AUDIO_DIR, fileName), req.file!.buffer);
        audioUrl = `/audio/${fileName}`;
      } catch (saveErr) {
        console.warn('[storage] Could not persist audio file:', saveErr);
      }
    }

    // Save story to persistent storage
    const newStory: Story = {
      id: `story-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      sessionId: sessionId || crypto.randomUUID(),
      userId,
      missionNumber,
      missionText,
      audioDurationSec: isNaN(audioDurationSec) ? undefined : audioDurationSec,
      audioMimeType: hasAudio ? (req.file?.mimetype || 'audio/webm') : 'text/plain',
      audioUrl,
      outdoorDurationSec,
      outdoorDistanceM,
      transcript: analysis.transcript,
      theme: analysis.theme,
      extracted: analysis.extracted,
      summary: analysis.summary,
      culturalSignificance: analysis.culturalSignificance,
      nextMission: analysis.nextMission,
      createdAt: new Date().toISOString(),
    };

    storyStorage.add(newStory);

    const sessionCount = storyStorage.getBySession(newStory.sessionId).length;
    const totalStories = storyStorage.count();

    res.json({
      success: true,
      storyId: newStory.id,
      providerUsed: analysis.providerUsed,
      transcript: analysis.transcript,
      theme: analysis.theme,
      extracted: analysis.extracted,
      summary: analysis.summary,
      culturalSignificance: analysis.culturalSignificance,
      nextMission: analysis.nextMission,
      nextMissionNumber: missionNumber + 1,
      sessionCount,
      totalStories,
      proof:
        outdoorDurationSec !== undefined || outdoorDistanceM !== undefined
          ? { durationSec: outdoorDurationSec, distanceM: outdoorDistanceM }
          : undefined,
    });
  } catch (error: unknown) {
    console.error('Analysis error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error during audio analysis.';
    res.status(500).json({
      error: message,
      code: 'AI_ERROR',
    });
  }
});

// GET /api/stats
app.get('/api/stats', (_req: Request, res: Response) => {
  res.json({
    totalStories: storyStorage.count(),
  });
});

// GET /api/stories
app.get('/api/stories', (_req: Request, res: Response) => {
  res.json({
    stories: storyStorage.getAll(),
  });
});

// ==========================================
// VITE INTEGRATION
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PALABRE] Server listening on http://0.0.0.0:${PORT}`);
    healthMonitor.start();
  });
}

startServer().catch((err) => {
  console.error('[PALABRE] Failed to start server:', err);
  process.exit(1);
});
