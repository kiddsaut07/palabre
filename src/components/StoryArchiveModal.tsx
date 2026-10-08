import React, { useState } from 'react';
import { X, Sparkles, BookOpen, Quote, Calendar, Volume2, Footprints } from 'lucide-react';
import { Story } from '../types';
import { AudioPlayer } from './AudioPlayer';

function formatProof(story: Story): string | null {
  const parts: string[] = [];
  if (story.outdoorDistanceM !== undefined) parts.push(`${story.outdoorDistanceM} m`);
  if (story.outdoorDurationSec !== undefined) {
    const m = Math.floor(story.outdoorDurationSec / 60);
    parts.push(m > 0 ? `${m} min` : `${Math.round(story.outdoorDurationSec)} s`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

interface StoryArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  stories: Story[];
}

export const StoryArchiveModal: React.FC<StoryArchiveModalProps> = ({
  isOpen,
  onClose,
  stories,
}) => {
  const [selectedTheme, setSelectedTheme] = useState<string>('all');

  if (!isOpen) return null;

  const themes = ['all', ...Array.from(new Set(stories.map((s) => s.theme.toLowerCase())))];
  const filteredStories =
    selectedTheme === 'all'
      ? stories
      : stories.filter((s) => s.theme.toLowerCase() === selectedTheme);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
    >
      <div className="bg-[#0D0D0D] border border-[#262220] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#1C1A18] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-[#FF6B35]" />
            <div>
              <h3 id="archive-title" className="text-lg font-bold text-[#F2EEE8] font-display uppercase tracking-wide">
                Community Oral Archive
              </h3>
              <p className="text-xs text-[#77736D] font-mono">
                {stories.length} stories preserved from the streets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close archive"
            className="p-1.5 text-[#77736D] hover:text-[#F2EEE8] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Theme Filters */}
        {themes.length > 2 && (
          <div className="px-5 py-3 border-b border-[#1A1816] flex items-center gap-2 overflow-x-auto no-scrollbar">
            {themes.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTheme(t)}
                className={`text-[11px] font-mono uppercase tracking-wider px-3 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                  selectedTheme === t
                    ? 'bg-[#FF6B35] text-[#090909] font-bold'
                    : 'bg-[#171514] text-[#A39E96] hover:text-[#F2EEE8]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Stories List */}
        <div className="p-5 overflow-y-auto space-y-4">
          {filteredStories.length === 0 ? (
            <div className="text-center py-12 text-[#77736D] text-sm">
              No stories captured yet in this category.
            </div>
          ) : (
            filteredStories.map((story) => (
              <div
                key={story.id}
                className="bg-[#141414] border border-[#242220] hover:border-[#38332E] rounded-xl p-4 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#FF6B35] bg-[#1F1410] px-2 py-0.5 rounded border border-[#FF6B35]/30">
                    {story.theme}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#77736D] font-mono">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(story.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="mb-2">
                  <p className="font-editorial text-base text-[#F2EEE8] italic leading-snug">
                    &ldquo;{story.extracted}&rdquo;
                  </p>
                </div>

                <p className="text-xs text-[#A39E96] leading-relaxed mb-2">
                  {story.summary}
                </p>

                {story.audioUrl && (
                  <div className="mb-2">
                    <AudioPlayer src={story.audioUrl} label="Original Voice" />
                  </div>
                )}

                <div className="text-[11px] text-[#77736D] border-t border-[#1C1A18] pt-2 flex items-center justify-between gap-2 flex-wrap">
                  <span>Mission: {story.missionNumber}</span>
                  <div className="flex items-center gap-3">
                    {formatProof(story) && (
                      <span className="flex items-center gap-1 text-[#FF6B35]">
                        <Footprints className="w-3 h-3" />
                        {formatProof(story)}
                      </span>
                    )}
                    {story.audioDurationSec && (
                      <span className="flex items-center gap-1">
                        <Volume2 className="w-3 h-3 text-[#FF6B35]" />
                        {story.audioDurationSec}s voice
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
