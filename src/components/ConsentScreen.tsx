import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, ArrowLeft, Lock, Check } from 'lucide-react';

interface ConsentScreenProps {
  onConfirm: () => void;
  onBack: () => void;
}

export const ConsentScreen: React.FC<ConsentScreenProps> = ({ onConfirm, onBack }) => {
  const [hasPermission, setHasPermission] = useState(false);

  return (
    <div className="min-h-screen bg-[#090909] text-[#F2EEE8] flex flex-col justify-between px-6 py-8 sm:py-12 max-w-xl mx-auto selection:bg-[#FF6B35] selection:text-[#090909]">
      <header className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-[#77736D] hover:text-[#F2EEE8] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <div className="text-xs font-mono text-[#77736D] uppercase">Ethics & Consent</div>
      </header>

      <main className="my-auto py-8 flex flex-col gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-mono tracking-widest text-[#FF6B35] uppercase mb-2">
            <Lock className="w-3.5 h-3.5" />
            <span>Human Voice Ethics</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F2EEE8] font-display uppercase">
            One Small Thing
          </h2>
        </div>

        <p className="text-base text-[#D4CEC5] leading-relaxed">
          You&apos;re about to record another person&apos;s voice.
        </p>

        <div className="border-l-2 border-[#FF6B35] pl-4 py-2 bg-[#141414] rounded-r-lg">
          <p className="text-lg font-medium text-[#F2EEE8] font-editorial">
            Ask for their permission first.
          </p>
          <p className="text-xs text-[#77736D] mt-1">
            Explain that their voice will be heard to preserve neighborhood oral memory.
          </p>
        </div>

        {/* Privacy guidelines */}
        <div className="bg-[#121110] border border-[#242220] rounded-xl p-4 text-xs text-[#A39E96] space-y-2">
          <div className="font-semibold text-[#F2EEE8] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#FF6B35]" />
            <span>Respecting the Speaker</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-[#8F8A82]">
            <li>Always obtain clear spoken consent before pressing record.</li>
            <li>Avoid recording passwords, money details, or confidential personal data.</li>
            <li>Never record someone without their direct knowledge.</li>
          </ul>
        </div>

        {/* Explicit Checkbox Confirmation */}
        <label className="flex items-start gap-3.5 p-4 bg-[#141414] border border-[#2B2825] rounded-xl cursor-pointer hover:border-[#FF6B35]/60 transition-colors select-none">
          <div className="relative flex items-center justify-center shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={hasPermission}
              onChange={(e) => setHasPermission(e.target.checked)}
              className="peer sr-only"
            />
            <div
              className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                hasPermission
                  ? 'bg-[#FF6B35] border-[#FF6B35] text-[#090909]'
                  : 'border-[#77736D] bg-transparent'
              }`}
            >
              {hasPermission && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </div>
          <span className="text-sm font-medium text-[#F2EEE8]">
            I have permission to record.
          </span>
        </label>

        {/* CTA */}
        <button
          onClick={onConfirm}
          disabled={!hasPermission}
          className={`w-full py-4 px-6 font-bold tracking-wider text-sm sm:text-base rounded-lg flex items-center justify-center gap-3 font-display uppercase transition-all ${
            hasPermission
              ? 'bg-[#FF6B35] hover:bg-[#ff7b4b] text-[#090909] cursor-pointer shadow-lg shadow-[#FF6B35]/20 active:scale-[0.98]'
              : 'bg-[#242220] text-[#77736D] cursor-not-allowed opacity-60'
          }`}
        >
          <span>Continue to Mission</span>
          <ArrowRight className="w-5 h-5 stroke-[2.5]" />
        </button>
      </main>

      <footer className="text-center text-xs text-[#77736D] font-mono">
        Palabre records genuine oral heritage.
      </footer>
    </div>
  );
};
