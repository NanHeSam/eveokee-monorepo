import { PlayIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import type { Id } from "@backend/convex/convex/_generated/dataModel";

interface MusicCardProps {
  musicId: Id<"music">;
  title?: string;
  imageUrl?: string;
  diaryContent?: string;
  diaryDate?: number;
  status: "pending" | "ready" | "failed";
  onPlay: () => void;
}

export function MusicCard({
  musicId,
  title,
  imageUrl,
  diaryContent,
  diaryDate,
  status,
  onPlay,
}: MusicCardProps) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/dashboard/music/${musicId}`);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status === "ready") {
      onPlay();
    }
  };

  const excerpt = diaryContent
    ? diaryContent.length > 200
      ? `${diaryContent.substring(0, 200)}...`
      : diaryContent
    : "";

  return (
    <article
      onClick={handleCardClick}
      className="group cursor-pointer py-6 md:py-8 flex gap-4 md:gap-8 items-start hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors -mx-4 px-4 rounded-lg"
    >
      {/* Content - Left side */}
      <div className="flex-1 min-w-0">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {title || "Untitled"}
        </h2>

        {excerpt && (
          <p className="text-slate-600 dark:text-slate-400 mb-3 line-clamp-2 leading-relaxed text-sm md:text-base">
            {excerpt}
          </p>
        )}

        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          {diaryDate && (
            <time>{format(new Date(diaryDate), "MMM d, yyyy")}</time>
          )}
          {status === "pending" && (
            <>
              <span>•</span>
              <span className="text-amber-600 dark:text-amber-400">Generating...</span>
            </>
          )}
          {status === "failed" && (
            <>
              <span>•</span>
              <span className="text-red-600 dark:text-red-400">Failed</span>
            </>
          )}
        </div>
      </div>

      {/* Image - Right side */}
      <div className="relative w-28 h-28 sm:w-40 sm:h-28 md:w-48 md:h-32 flex-shrink-0 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title || "Music cover"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-slate-400 dark:text-slate-500 text-sm">
              No image
            </div>
          </div>
        )}

        {/* Play button overlay */}
        {status === "ready" && (
          <button
            onClick={handlePlayClick}
            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            aria-label="Play music"
          >
            <div className="bg-white rounded-full p-3 shadow-lg transform hover:scale-110 transition-transform">
              <PlayIcon className="w-6 h-6 text-slate-900" fill="currentColor" />
            </div>
          </button>
        )}

        {/* Loading state */}
        {status === "pending" && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
          </div>
        )}

        {/* Failed state */}
        {status === "failed" && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="text-white text-xs">Failed</div>
          </div>
        )}
      </div>
    </article>
  );
}
