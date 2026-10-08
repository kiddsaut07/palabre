import React from 'react';
import { ArrowRight, Compass, Sparkles, BookOpen, User } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface HomeScreenProps {
  storyCount: number;
  onStartQuest: () => void;
  onViewArchive: () => void;
  currentUser: FirebaseUser | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  storyCount,
  onStartQuest,
  onViewArchive,
  currentUser,
  onSignIn,
  onSignOut,
}) => {
  return (
    <div className="min-h-screen bg-[#090909] text-[#F2EEE8] flex flex-col justify-between px-6 py-8 sm:py-12 max-w-xl mx-auto selection:bg-[#FF6B35] selection:text-[#090909]">
      {/* Top bar: minimal community status & optional explorer profile */}
      <header className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 text-xs tracking-widest text-[#77736D] uppercase font-mono">
          <span className="w-2 h-2 rounded-full bg-[#FF6B35] animate-pulse" />
          <span>Yaoundé & Beyond</span>
        </div>

        {currentUser ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#A39E96] truncate max-w-[120px]">
              {currentUser.displayName || currentUser.email}
            </span>
            <button
              onClick={onSignOut}
              className="text-xs text-[#77736D] hover:text-[#FF6B35] underline cursor-pointer"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={onSignIn}
            className="flex items-center gap-1.5 text-xs text-[#77736D] hover:text-[#F2EEE8] transition-colors cursor-pointer"
            title="Sign in with Google to sync your collected stories"
          >
            <User className="w-3.5 h-3.5" />
            <span>Explorer Sign-in</span>
          </button>
        )}
      </header>

      {/* Main Hero & Core Proposition */}
      <main className="my-auto py-8 flex flex-col gap-8">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-[#FF6B35] uppercase mb-3">
            <Compass className="w-4 h-4" />
            <span>Physical Cultural Quest</span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-[#F2EEE8] font-display uppercase leading-none">
            PALABRE
          </h1>
        </div>

        <div className="border-l-2 border-[#FF6B35] pl-4 py-1">
          <p className="font-editorial text-2xl sm:text-3xl text-[#F2EEE8] leading-tight font-medium">
            &ldquo;Your phone knows the internet.
            <br />
            <span className="text-[#FF6B35]">Your neighborhood knows the stories.</span>&rdquo;
          </p>
        </div>

        <p className="text-sm sm:text-base text-[#A39E96] font-normal leading-relaxed">
          A cultural treasure hunt powered by AI.
        </p>

        {/* The 4-step physical mandate */}
        <div className="bg-[#141414] border border-[#242220] rounded-xl p-5 space-y-3 font-mono text-xs sm:text-sm text-[#D4CEC5]">
          <div className="flex items-center gap-3">
            <span className="text-[#FF6B35] font-bold">01</span>
            <span>Put your phone down.</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#FF6B35] font-bold">02</span>
            <span>Find someone in your neighborhood.</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#FF6B35] font-bold">03</span>
            <span>Ask them something meaningful.</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#FF6B35] font-bold">04</span>
            <span>Come back with their story.</span>
          </div>
        </div>

        {/* CTA Primary Action */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={onStartQuest}
            className="w-full py-4 px-6 bg-[#FF6B35] hover:bg-[#ff7b4b] text-[#090909] font-bold tracking-wider text-sm sm:text-base rounded-lg flex items-center justify-center gap-3 transition-transform active:scale-[0.98] cursor-pointer shadow-lg shadow-[#FF6B35]/20 font-display uppercase"
          >
            <span>Start a Quest</span>
            <ArrowRight className="w-5 h-5 stroke-[2.5]" />
          </button>

          {storyCount > 0 && (
            <button
              onClick={onViewArchive}
              className="w-full sm:w-auto py-3 px-5 bg-transparent border border-[#242220] hover:border-[#77736D] text-[#D4CEC5] text-xs sm:text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#FF6B35]" />
              <span className="whitespace-nowrap">Archive</span>
            </button>
          )}
        </div>
      </main>

      {/* Footer / Reality stats */}
      <footer className="pt-6 border-t border-[#1C1A18] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#77736D]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#FF6B35]" />
          <span className="font-mono text-[#F2EEE8] font-semibold">{storyCount}</span>
          <span>{storyCount === 1 ? 'story' : 'stories'} collected in collective memory</span>
        </div>
        <p className="text-center sm:text-right italic">
          Built for real conversations, not endless scrolling.
        </p>
      </footer>
    </div>
  );
};
