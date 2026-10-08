import { useState, useRef, useEffect, useCallback } from 'react';
import { AppError } from '../types';

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  durationSec: number;
  formattedDuration: string;
  audioLevel: number;
  error: AppError | null;
  mimeType: string;
  startRecording: () => Promise<boolean>;
  stopRecording: () => void;
  resetRecording: () => void;
  clearError: () => void;
}

const MAX_RECORDING_DURATION_SEC = 180; // 3 minutes limit
const MIN_RECORDING_DURATION_SEC = 2; // minimum threshold to prevent empty clicks

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState<number>(0);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [error, setError] = useState<AppError | null>(null);
  const [mimeType, setMimeType] = useState<string>('audio/webm');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Helper to select best supported audio mime type
  const getSupportedMimeType = (): string => {
    if (typeof MediaRecorder === 'undefined') return 'audio/webm';
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/wav',
      'audio/aac',
    ];
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  };

  const cleanupAudioNodes = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setAudioLevel(0);
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error('Failed to stop media recorder:', err);
      }
    }
    cleanupAudioNodes();
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  const resetRecording = useCallback(() => {
    stopRecording();
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setDurationSec(0);
    setError(null);
    audioChunksRef.current = [];
  }, [audioUrl, stopRecording]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    setError(null);
    resetRecording();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError({
        type: 'MICROPHONE_DENIED',
        message: 'Audio recording is not supported in this browser.',
      });
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const selectedType = getSupportedMimeType();
      setMimeType(selectedType || 'audio/webm');

      const options: MediaRecorderOptions = {};
      if (selectedType) {
        options.mimeType = selectedType;
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      // Audio analysis for real-time waveform level
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateLevel = () => {
            if (analyserRef.current) {
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const average = sum / dataArray.length;
              setAudioLevel(Math.min(1, average / 128));
              animationFrameRef.current = requestAnimationFrame(updateLevel);
            }
          };
          updateLevel();
        }
      } catch (audioCtxError) {
        console.warn('Audio visualization context not available:', audioCtxError);
      }

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const actualType = recorder.mimeType || selectedType || 'audio/webm';
        const finalBlob = new Blob(audioChunksRef.current, { type: actualType });
        const finalDuration = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));

        if (finalDuration < MIN_RECORDING_DURATION_SEC) {
          setError({
            type: 'AUDIO_TOO_SHORT',
            message: 'Recording was too short. Please capture at least a few seconds of voice.',
          });
          setAudioBlob(null);
          setAudioUrl(null);
          return;
        }

        if (finalBlob.size > 25 * 1024 * 1024) {
          setError({
            type: 'AUDIO_TOO_LARGE',
            message: 'Recording exceeds 25MB limit. Please re-record a shorter story.',
          });
          setAudioBlob(null);
          setAudioUrl(null);
          return;
        }

        if (finalBlob.size < 500) {
          setError({
            type: 'INVALID_RECORDING',
            message: 'Recording appears to be silent or empty. Please check your microphone.',
          });
          setAudioBlob(null);
          setAudioUrl(null);
          return;
        }

        setAudioBlob(finalBlob);
        const url = URL.createObjectURL(finalBlob);
        setAudioUrl(url);
      };

      startTimeRef.current = Date.now();
      recorder.start(500); // 500ms time slice
      setIsRecording(true);
      setDurationSec(0);

      // Timer
      timerIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
        setDurationSec(elapsed);

        if (elapsed >= MAX_RECORDING_DURATION_SEC) {
          stopRecording();
        }
      }, 500);

      return true;
    } catch (err: unknown) {
      console.error('Error starting audio recording:', err);
      const isNotAllowed = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      setError({
        type: isNotAllowed ? 'MICROPHONE_DENIED' : 'UNKNOWN_ERROR',
        message: isNotAllowed
          ? 'Microphone permission was denied. Please allow microphone access to record stories.'
          : 'Could not access microphone. Please check your device settings.',
      });
      cleanupAudioNodes();
      setIsRecording(false);
      return false;
    }
  }, [resetRecording, stopRecording]);

  useEffect(() => {
    return () => {
      cleanupAudioNodes();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    isRecording,
    isPaused,
    audioBlob,
    audioUrl,
    durationSec,
    formattedDuration: formatTime(durationSec),
    audioLevel,
    error,
    mimeType,
    startRecording,
    stopRecording,
    resetRecording,
    clearError: () => setError(null),
  };
}
