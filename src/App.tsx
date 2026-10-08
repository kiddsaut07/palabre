import React, { useState, useEffect, useCallback } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db, validateFirestoreConnection } from './config/firebase';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { useOutdoorProof } from './hooks/useOutdoorProof';
import { HomeScreen } from './components/HomeScreen';
import { ConsentScreen } from './components/ConsentScreen';
import { MissionScreen } from './components/MissionScreen';
import { ProcessingScreen } from './components/ProcessingScreen';
import { ResultScreen } from './components/ResultScreen';
import { NextMissionScreen } from './components/NextMissionScreen';
import { StoryArchiveModal } from './components/StoryArchiveModal';
import { DevDebugPanel } from './components/DevDebugPanel';
import { startMission, analyzeRecording, fetchStats, fetchStories } from './services/api';
import { getRandomStarterQuest } from './data/starterQuests';
import { ScreenState, AppError, AIAnalysisResult, Story, AnalyzeResponse } from './types';

const SESSION_STORAGE_KEY = 'palabre_session_id';
const MISSION_NUM_KEY = 'palabre_mission_num';

export default function App() {
  const [screen, setScreen] = useState<ScreenState>('HOME');
  const [sessionId, setSessionId] = useState<string>('');
  const [missionNumber, setMissionNumber] = useState<number>(1);
  const [currentMission, setCurrentMission] = useState<string>('');
  const [currentTheme, setCurrentTheme] = useState<string>('wisdom');
  const [nextMissionText, setNextMissionText] = useState<string>('');
  const [sessionStoryCount, setSessionStoryCount] = useState<number>(0);
  const [totalStoriesCount, setTotalStoriesCount] = useState<number>(2);
  const [lastAnalysis, setLastAnalysis] = useState<AIAnalysisResult | null>(null);
  const [lastAudioUrl, setLastAudioUrl] = useState<string | null>(null);
  const [lastProof, setLastProof] = useState<AnalyzeResponse['proof'] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [appError, setAppError] = useState<AppError | null>(null);
  const [archiveOpen, setArchiveOpen] = useState<boolean>(false);
  const [archiveStories, setArchiveStories] = useState<Story[]>([]);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

  const recorder = useAudioRecorder();
  const outdoorProof = useOutdoorProof();

  // Initialize session and restore/generate ID
  useEffect(() => {
    // 1. Session ID
    let sid = '';
    try {
      sid = localStorage.getItem(SESSION_STORAGE_KEY) || '';
      if (!sid) {
        sid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `palabre-${Date.now()}`;
        localStorage.setItem(SESSION_STORAGE_KEY, sid);
      }
    } catch {
      sid = `palabre-${Date.now()}`;
    }
    setSessionId(sid);

    // 2. Fetch remote stats & stories
    fetchStats()
      .then((res) => setTotalStoriesCount(res.totalStories))
      .catch((err) => console.warn('Could not load initial stats:', err));

    fetchStories()
      .then((res) => setArchiveStories(res.stories))
      .catch((err) => console.warn('Could not load archive:', err));

    // 3. Test Firestore connection per skill requirements
    validateFirestoreConnection();

    // 4. Firebase Auth listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return () => unsubscribe();
  }, []);

  // Handler: Google Sign-in for explorer account
  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      console.warn('Google sign-in skipped or cancelled:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err: unknown) {
      console.warn('Sign-out error:', err);
    }
  };

  // Start a quest: from Home -> Consent
  const handleStartQuest = async () => {
    setAppError(null);
    try {
      const missionData = await startMission(sessionId);
      setCurrentMission(missionData.mission);
      setCurrentTheme(missionData.theme);
      setMissionNumber(missionData.missionNumber || 1);
    } catch (err) {
      console.warn('Fallback to local starter quest:', err);
      const fallback = getRandomStarterQuest();
      setCurrentMission(fallback.missionText);
      setCurrentTheme(fallback.theme);
      setMissionNumber(1);
    }
    setScreen('CONSENT');
  };

  // Consent accepted -> Mission screen (the field proof starts now: clock + GPS)
  const handleConsentConfirmed = () => {
    outdoorProof.beginMission();
    setScreen('MISSION');
  };

  // User aborts quest -> return to Home
  const handleAbortQuest = () => {
    outdoorProof.reset();
    recorder.resetRecording();
    setScreen('HOME');
  };

  // Submitting recording to AI Cultural Intelligence Engine
  const handleSubmitStory = async (blob: Blob, durationSec: number) => {
    setIsSubmitting(true);
    setAppError(null);
    setScreen('PROCESSING');

    // Retain object URL for playback on Result screen
    const capturedAudioUrl = URL.createObjectURL(blob);
    setLastAudioUrl(capturedAudioUrl);

    // Collect the field proof (time outside + distance walked) — never blocks the quest
    const proof = await outdoorProof.collect().catch(() => undefined);

    try {
      const formData = new FormData();
      formData.append('audio', blob, `mission-${missionNumber}.webm`);
      formData.append('sessionId', sessionId);
      formData.append('missionNumber', missionNumber.toString());
      formData.append('missionText', currentMission);
      formData.append('audioDurationSec', durationSec.toString());
      if (proof?.durationSec !== undefined) {
        formData.append('outdoorDurationSec', proof.durationSec.toString());
      }
      if (proof?.distanceM !== undefined) {
        formData.append('distanceMeters', proof.distanceM.toString());
      }
      if (currentUser?.uid) {
        formData.append('userId', currentUser.uid);
      }

      const result = await analyzeRecording(formData);

      setLastAnalysis(result);
      setNextMissionText(result.nextMission);
      setSessionStoryCount(result.sessionCount);
      setTotalStoriesCount(result.totalStories);
      setLastProof(result.proof || proof || null);

      // Persist also to Firestore if connected
      try {
        await addDoc(collection(db, 'stories'), {
          sessionId,
          userId: currentUser?.uid || null,
          missionNumber,
          missionText: currentMission,
          audioDurationSec: durationSec,
          audioMimeType: blob.type || 'audio/webm',
          transcript: result.transcript,
          theme: result.theme,
          extracted: result.extracted,
          summary: result.summary,
          culturalSignificance: result.culturalSignificance,
          nextMission: result.nextMission,
          createdAt: serverTimestamp(),
        });
      } catch (firestoreErr) {
        console.warn('Firestore optional sync notice:', firestoreErr);
      }

      // Refresh archive
      fetchStories().then((res) => setArchiveStories(res.stories)).catch(() => {});

      // Transition to Result Screen
      recorder.resetRecording();
      setScreen('RESULT');
    } catch (error: unknown) {
      console.error('Error analyzing story:', error);
      const msg = error instanceof Error ? error.message : 'Analysis failed. Please try again.';
      setAppError({
        type: 'AI_ERROR',
        message: msg,
      });
      // Return to mission screen so user can re-try
      setScreen('MISSION');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Move from Result -> Next Mission explanation
  const handleGoToNextQuest = () => {
    setScreen('NEXT_MISSION');
  };

  // Move from Next Mission -> New Mission
  const handleReadyForNextMission = () => {
    setCurrentMission(nextMissionText);
    setMissionNumber((prev) => prev + 1);
    if (lastAnalysis?.theme) {
      setCurrentTheme(lastAnalysis.theme);
    }
    setLastAnalysis(null);
    setLastProof(null);
    recorder.resetRecording();
    outdoorProof.beginMission();
    setScreen('MISSION');
  };

  // Open community archive
  const handleOpenArchive = async () => {
    try {
      const res = await fetchStories();
      setArchiveStories(res.stories);
    } catch (err) {
      console.warn('Failed to refresh archive:', err);
    }
    setArchiveOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#090909] text-[#F2EEE8] flex flex-col font-sans selection:bg-[#FF6B35] selection:text-[#090909]">
      {screen === 'HOME' && (
        <HomeScreen
          storyCount={totalStoriesCount}
          onStartQuest={handleStartQuest}
          onViewArchive={handleOpenArchive}
          currentUser={currentUser}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
        />
      )}

      {screen === 'CONSENT' && (
        <ConsentScreen
          onConfirm={handleConsentConfirmed}
          onBack={() => setScreen('HOME')}
        />
      )}

      {screen === 'MISSION' && (
        <MissionScreen
          missionNumber={missionNumber}
          missionText={currentMission}
          theme={currentTheme}
          recorder={recorder}
          onSubmitStory={handleSubmitStory}
          onAbortQuest={handleAbortQuest}
          isSubmitting={isSubmitting}
        />
      )}

      {screen === 'PROCESSING' && <ProcessingScreen />}

      {screen === 'RESULT' && lastAnalysis && (
        <ResultScreen
          analysis={lastAnalysis}
          sessionCount={sessionStoryCount}
          totalStories={totalStoriesCount}
          audioUrl={lastAudioUrl}
          proof={lastProof}
          onGoToNextQuest={handleGoToNextQuest}
        />
      )}

      {screen === 'NEXT_MISSION' && (
        <NextMissionScreen
          missionNumber={missionNumber + 1}
          missionText={nextMissionText}
          theme={currentTheme}
          onReady={handleReadyForNextMission}
        />
      )}

      {/* Community Oral Archive Modal */}
      <StoryArchiveModal
        isOpen={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        stories={archiveStories}
      />

      {/* Developer Diagnostic Panel (active only when DEV_PANEL_ENABLED=true or ?debug=ai) */}
      <DevDebugPanel />
    </div>
  );
}
