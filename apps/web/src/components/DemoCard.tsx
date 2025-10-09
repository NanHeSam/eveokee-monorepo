import { Music } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import MusicPlayer from './MusicPlayer';

export default function DemoCard(props: {
  lyric: string;
  title: string;
  date: string;
  imageUrl?: string;
  audioId: string;
  audioUrl: string;
  duration: string;
  startTime?: number;
  onPlay?: () => void;
}) {
  const { lyric, title, date, imageUrl, audioId, audioUrl, duration, startTime, onPlay } = props;

  // Lyric scroll affordance
  const lyricRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [scrolledEnough, setScrolledEnough] = useState(false);
  const [atBottom, setAtBottom] = useState(false);
  const [scrollThreshold, setScrollThreshold] = useState(48); // ~2 lines default
  const paragraphRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = lyricRef.current;
    if (!el) return;

    const computeThreshold = () => {
      let lh = 24; // fallback for text-lg
      const p = paragraphRef.current;
      if (p) {
        const cs = window.getComputedStyle(p);
        const parsed = parseFloat(cs.lineHeight);
        if (!Number.isNaN(parsed) && parsed > 0) {
          lh = parsed;
        }
      }
      const thr = lh * 2; // two lines
      setScrollThreshold(thr);
      return thr;
    };

    const runChecks = () => {
      const threshold = computeThreshold();
      const overflow = el.scrollHeight > el.clientHeight;
      setIsOverflowing(overflow);
      setScrolledEnough(el.scrollTop >= threshold);
      setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
    };

    runChecks();

    // Recalculate on size changes
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => runChecks());
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [lyric]);

  const handleLyricScroll = () => {
    const el = lyricRef.current;
    if (!el) return;
    setScrolledEnough(el.scrollTop >= scrollThreshold);
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow duration-200 flex flex-col h-full">
      {/* Diary Line */}
      <div className="mb-6">
        <div
          ref={lyricRef}
          onScroll={handleLyricScroll}
          className="relative h-[180px] overflow-y-auto pr-2 flex items-start"
        >
          <p ref={paragraphRef} className="text-gray-800 dark:text-gray-200 font-medium text-lg leading-relaxed whitespace-pre-line">
            {lyric}
          </p>
          {isOverflowing && !(scrolledEnough || atBottom) && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-gray-800 to-transparent flex items-end justify-center">
              <span className="mb-2 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 bg-white/80 dark:bg-gray-800/80 rounded-full border border-gray-200 dark:border-gray-600">
                Scroll for more
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Track Info */}
      <div className="mb-6 flex-shrink-0">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{date}</p>
      </div>

      {/* Album Artwork */}
      <div className="mb-6 flex-shrink-0">
        <div className="w-full aspect-[16/9] bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`Album artwork for ${title}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <Music className="w-16 h-16 text-accent-mint/60" />
          )}
        </div>
      </div>

      {/* Music Player */}
      <div className="mt-auto">
        <MusicPlayer
          audioId={audioId}
          audioUrl={audioUrl}
          startTime={startTime}
          duration={duration}
          onPlay={onPlay}
        />
      </div>
    </div>
  );
}