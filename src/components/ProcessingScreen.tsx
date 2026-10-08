import React from 'react';
import { Ear } from 'lucide-react';

export const ProcessingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#090909] text-[#F2EEE8] flex flex-col justify-between px-6 py-12 max-w-xl mx-auto selection:bg-[#FF6B35] selection:text-[#090909]">
      <header className="flex items-center justify-between opacity-50">
        <span className="text-xs font-mono text-[#77736D] uppercase">PALABRE AI</span>
        <span className="text-xs font-mono text-[#FF6B35] uppercase">Processing</span>
      </header>

      <main className="my-auto flex flex-col items-center text-center gap-6 py-8">
        {/* Subtle, physical-feeling pulse indicator */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-[#FF6B35]/30 animate-ping opacity-75" />
          <div className="w-20 h-20 rounded-full bg-[#141414] border border-[#FF6B35] flex items-center justify-center shadow-lg shadow-[#FF6B35]/10">
            <Ear className="w-8 h-8 text-[#FF6B35]" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F2EEE8] font-display uppercase">
            Listening to Your Story
          </h2>
          <p className="text-sm text-[#A39E96] max-w-sm mx-auto leading-relaxed">
            The AI is extracting the part worth remembering.
          </p>
        </div>

        {/* Subtle soundwave ripple bars */}
        <div className="flex items-center gap-1.5 h-6">
          <span className="w-1 bg-[#FF6B35] h-3 animate-pulse" />
          <span className="w-1 bg-[#FF6B35] h-5 animate-pulse [animation-delay:150ms]" />
          <span className="w-1 bg-[#FF6B35] h-6 animate-pulse [animation-delay:300ms]" />
          <span className="w-1 bg-[#FF6B35] h-4 animate-pulse [animation-delay:450ms]" />
          <span className="w-1 bg-[#FF6B35] h-2 animate-pulse [animation-delay:600ms]" />
        </div>
      </main>

      <footer className="text-center text-xs text-[#77736D] font-mono">
        Preserving oral knowledge from the streets.
      </footer>
    </div>
  );
};
