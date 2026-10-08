import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2 } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  label?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, label = 'Recorded Voice' }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => console.error('Audio playback failed:', err));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const seekTime = parseFloat(e.target.value);
    audio.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const restart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play();
  };

  const format = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full bg-[#141414] border border-[#242220] rounded-xl p-4 flex flex-col gap-2">
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="flex items-center justify-between text-xs text-[#77736D] uppercase tracking-wider font-medium">
        <span className="flex items-center gap-1.5 text-[#A39E96]">
          <Volume2 className="w-3.5 h-3.5 text-[#FF6B35]" />
          {label}
        </span>
        <span>
          {format(currentTime)} / {format(duration || currentTime)}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          className="w-10 h-10 rounded-full bg-[#242220] hover:bg-[#FF6B35] text-[#F2EEE8] hover:text-[#090909] flex items-center justify-center transition-all cursor-pointer shrink-0"
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          aria-label="Seek audio playback"
          className="w-full accent-[#FF6B35] cursor-pointer h-1.5 bg-[#242220] rounded-lg appearance-none"
        />

        <button
          onClick={restart}
          aria-label="Restart audio"
          className="p-2 text-[#77736D] hover:text-[#F2EEE8] transition-colors cursor-pointer shrink-0"
          title="Restart"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
