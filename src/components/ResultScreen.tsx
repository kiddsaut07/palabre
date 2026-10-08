import React, { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Quote, Sparkles, Volume2, Footprints } from 'lucide-react';
import { AIAnalysisResult, AnalyzeResponse } from '../types';
import { AudioPlayer } from './AudioPlayer';

interface ResultScreenProps {
  analysis: AIAnalysisResult;
  sessionCount: number;
  totalStories: number;
  audioUrl?: string | null;
  proof?: AnalyzeResponse['proof'] | null;
  onGoToNextQuest: () => void;
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  analysis,
  sessionCount,
  totalStories,
  audioUrl,
  proof,
  onGoToNextQuest,
}) => {
  const [showTranscript, setShowTranscript] = useState(false);

  const { theme, extracted, summary, culturalSignificance, transcript } = analysis;

  return (
    <div className="min-h-screen bg-[#090909] text-[#F2EEE8] flex flex-col justify-between px-6 py-6 sm:py-10 max-w-xl mx-auto selection:bg-[#FF6B35] selection:text-[#090909]">
      {/* Header with Theme Badge */}
      <header className="flex items-center justify-between pb-4 border-b border-[#1C1A18]">
        <div>
          <span className="text-[11px] font-mono tracking-widest text-[#77736D] uppercase block">
            Archive Entry
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#F2EEE8] font-display uppercase tracking-tight">
            Story Captured
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {analysis.providerUsed && (
            <span className="text-[10px] font-mono tracking-wider text-[#A39E96] bg-[#141414] border border-[#2B2825] px-2 py-0.5 rounded uppercase">
              AI: {analysis.providerUsed}
            </span>
          )}
          <span className="text-xs font-mono tracking-wider font-bold text-[#FF6B35] uppercase bg-[#1F1410] border border-[#FF6B35]/40 px-3 py-1 rounded-full">
            {theme}
          </span>
        </div>
      </header>

      {/* Main Content Sections */}
      <main className="my-auto py-6 flex flex-col gap-6">
        {/* Section 1: What was shared (Extracted nugget) */}
        <section className="bg-[#141414] border border-[#242220] rounded-xl p-5 relative">
          <Quote className="w-8 h-8 text-[#FF6B35]/20 absolute right-4 top-4 pointer-events-none" />
          <h3 className="text-xs font-mono uppercase tracking-wider text-[#FF6B35] font-semibold mb-2">
            What Was Shared
          </h3>
          <p className="font-editorial text-lg sm:text-xl text-[#F2EEE8] leading-snug font-medium italic">
            &ldquo;{extracted}&rdquo;
          </p>
        </section>

        {/* Section 2: The AI Heard (Summary) */}
        <section className="space-y-1">
          <h3 className="text-xs font-mono uppercase tracking-wider text-[#77736D] font-semibold">
            The AI Heard
          </h3>
          <p className="text-sm text-[#D4CEC5] leading-relaxed">
            {summary}
          </p>
        </section>

        {/* Section 3: Why it matters (Cultural Significance) */}
        <section className="space-y-1">
          <h3 className="text-xs font-mono uppercase tracking-wider text-[#77736D] font-semibold">
            Why It Matters
          </h3>
          <p className="text-sm text-[#A39E96] leading-relaxed border-l-2 border-[#FF6B35]/60 pl-3">
            {culturalSignificance}
          </p>
        </section>

        {/* Audio playback of captured voice if present */}
        {audioUrl && (
          <AudioPlayer src={audioUrl} label="Preserved Voice Recording" />
        )}

        {/* Supporting Evidence: Collapsible Transcript */}
        <div className="border-t border-[#1C1A18] pt-3">
          <button
            type="button"
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full flex items-center justify-between text-xs font-mono text-[#77736D] hover:text-[#F2EEE8] transition-colors py-1 cursor-pointer"
          >
            <span className="uppercase tracking-wider">
              {showTranscript ? 'Hide Spoken Transcript' : 'View Spoken Transcript'}
            </span>
            {showTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showTranscript && (
            <div className="mt-3 p-4 bg-[#11100F] border border-[#242220] rounded-lg text-xs font-mono text-[#A39E96] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
              {transcript}
            </div>
          )}
        </div>

        {/* Celebration / Impact stats */}
        <div className="bg-[#171513] border border-[#26211E] rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-[#77736D]">
              You Have Collected
            </div>
            <div className="text-lg font-bold text-[#F2EEE8] font-display">
              {sessionCount} {sessionCount === 1 ? 'Story' : 'Stories'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[#FF6B35] font-semibold flex items-center gap-1 justify-end">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Collective Archive</span>
            </div>
            <div className="text-[11px] text-[#A39E96] font-mono">
              The world now has {totalStories} {totalStories === 1 ? 'story' : 'stories'}.
            </div>
          </div>
        </div>

        {/* Field proof: evidence that the explorer actually went outside */}
        {proof && (proof.durationSec !== undefined || proof.distanceM !== undefined) && (
          <div className="bg-[#171513] border border-[#FF6B35]/30 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[#FF6B35]">
              <Footprints className="w-4 h-4" />
              <span className="text-[11px] font-mono uppercase tracking-widest font-semibold">
                Field Proof
              </span>
            </div>
            <div className="text-xs font-mono text-[#D4CEC5] text-right">
              {proof.distanceM !== undefined && <span>{proof.distanceM} m walked</span>}
              {proof.distanceM !== undefined && proof.durationSec !== undefined && <span> · </span>}
              {proof.durationSec !== undefined && <span>{formatElapsed(proof.durationSec)} outside</span>}
            </div>
          </div>
        )}

        {/* CTA to Next Quest */}
        <button
          type="button"
          onClick={onGoToNextQuest}
          className="w-full py-4 px-6 bg-[#FF6B35] hover:bg-[#ff7b4b] text-[#090909] font-bold tracking-wider text-sm sm:text-base rounded-lg flex items-center justify-center gap-3 font-display uppercase transition-transform active:scale-[0.98] shadow-lg shadow-[#FF6B35]/20 cursor-pointer"
        >
          <span>Next Quest</span>
          <ArrowRight className="w-5 h-5 stroke-[2.5]" />
        </button>
      </main>

      <footer className="text-center text-xs text-[#77736D] font-mono pt-4">
        Every oral recording preserves living community memory.
      </footer>
    </div>
  );
};
