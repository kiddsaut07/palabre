import React from 'react';
import { AlertCircle, X, RefreshCw } from 'lucide-react';
import { AppError } from '../types';

interface ErrorBannerProps {
  error: AppError;
  onDismiss: () => void;
  onRetry?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onDismiss, onRetry }) => {
  const getReadableMessage = (): { title: string; desc: string } => {
    switch (error.type) {
      case 'MICROPHONE_DENIED':
        return {
          title: 'Microphone Permission Needed',
          desc: 'Palabre needs permission to record spoken stories. Please tap the lock or settings icon in your browser address bar and enable microphone access.',
        };
      case 'AUDIO_TOO_SHORT':
        return {
          title: 'Recording Too Brief',
          desc: 'Please record at least a few seconds of voice so the story can be heard clearly.',
        };
      case 'AUDIO_TOO_LARGE':
        return {
          title: 'Recording Exceeded Size Limit',
          desc: 'The audio file is too large (over 25MB). Please keep your recording under 3 minutes.',
        };
      case 'INVALID_RECORDING':
        return {
          title: 'No Audio Detected',
          desc: 'The microphone did not capture audible sound. Please verify your microphone and speak closely.',
        };
      case 'NETWORK_ERROR':
        return {
          title: 'Connection Issue',
          desc: 'Could not connect to the Palabre server. Check your internet connection and try again.',
        };
      case 'AI_ERROR':
        return {
          title: 'Cultural Analysis Interrupted',
          desc: error.message || 'The AI service could not process this audio. Please retry or record another take.',
        };
      case 'SERVER_ERROR':
        return {
          title: 'Server Error',
          desc: error.message || 'An unexpected issue occurred on the server. Please try again.',
        };
      default:
        return {
          title: 'Something Went Wrong',
          desc: error.message || 'An unexpected error occurred. Please try again.',
        };
    }
  };

  const { title, desc } = getReadableMessage();

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="w-full bg-[#1A1110] border border-[#FF6B35]/40 text-[#F2EEE8] rounded-lg p-4 my-4 flex items-start gap-3 transition-all"
    >
      <AlertCircle className="w-5 h-5 text-[#FF6B35] shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        <h4 className="font-semibold text-[#FF6B35] tracking-wide mb-1">{title}</h4>
        <p className="text-[#A39E96] leading-relaxed">{desc}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF6B35] hover:text-[#ff8558] underline underline-offset-4 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </button>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="text-[#77736D] hover:text-[#F2EEE8] p-1 transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
