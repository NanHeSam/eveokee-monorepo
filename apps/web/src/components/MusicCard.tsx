import { PlayIcon } from "lucide-react";
import { useNavigate } from "react-router";
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
    ? diaryContent.length > 150
      ? `${diaryContent.substring(0, 150)}...`
      : diaryContent
    : "";

  return (
    <article
      onClick={handleCardClick}
      className="group cursor-pointer transition-all hover:translate-y-[-2px]"
    >
      <div className="relative overflow-hidden rounded-lg aspect-video bg-slate-100 dark:bg-slate-800">
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
            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            aria-label="Play music"
          >
            <div className="bg-white rounded-full p-4 shadow-lg transform hover:scale-110 transition-transform">
              <PlayIcon className="w-8 h-8 text-slate-900" fill="currentColor" />
            </div>
          </button>
        )}

        {/* Loading state */}
        {status === "pending" && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}

        {/* Failed state */}
        {status === "failed" && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="text-white text-sm">Generation failed</div>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {title || "Untitled"}
        </h3>

        {diaryDate && (
          <time className="text-sm text-slate-500 dark:text-slate-400">
            {format(new Date(diaryDate), "MMM d, yyyy")}
          </time>
        )}

        {excerpt && (
          <p className="text-slate-600 dark:text-slate-300 line-clamp-3 text-sm">
            {excerpt}
          </p>
        )}
      </div>
    </article>
  );
}
