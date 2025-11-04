import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@backend/convex";
import { ConvexQueryBoundary } from "../components/ConvexQueryBoundary";
import { MusicPlayer } from "../components/MusicPlayer";
import { ArrowLeftIcon, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { Id } from "@backend/convex/convex/_generated/dataModel";

type Tab = "lyrics" | "diary";

function MusicDetailContent({ musicId }: { musicId: Id<"music"> }) {
  const music = useQuery(api.music.getMusicById, { musicId });
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("lyrics");

  if (!music) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-slate-500 dark:text-slate-400">Music not found</p>
      </div>
    );
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Back button */}
      <button
        onClick={() => navigate("/dashboard")}
        className="flex items-center space-x-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors mb-6"
      >
        <ArrowLeftIcon className="w-5 h-5" />
        <span>Back to Dashboard</span>
      </button>

      {/* Hero section with image */}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 mb-8">
        {music.imageUrl ? (
          <img
            src={music.imageUrl}
            alt={music.title || "Music cover"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-slate-400 dark:text-slate-500">No image</div>
          </div>
        )}
      </div>

      {/* Title and metadata */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          {music.title || "Untitled"}
        </h1>

        {music.diaryDate && (
          <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 mb-4">
            <CalendarIcon className="w-5 h-5" />
            <time>{format(new Date(music.diaryDate), "MMMM d, yyyy")}</time>
          </div>
        )}

        {/* Music player */}
        {music.audioUrl && music.status === "ready" && (
          <div className="mb-6">
            <MusicPlayer
              audioId={music._id}
              audioUrl={music.audioUrl}
              duration={formatDuration(music.duration)}
              className="max-w-2xl"
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("lyrics")}
            className={`py-4 px-1 border-b-2 font-medium transition-colors ${
              activeTab === "lyrics"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Lyrics
          </button>
          <button
            onClick={() => setActiveTab("diary")}
            className={`py-4 px-1 border-b-2 font-medium transition-colors ${
              activeTab === "diary"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Diary Entry
          </button>
        </nav>
      </div>

      {/* Tab content */}
      <div className="prose dark:prose-invert max-w-none">
        {activeTab === "lyrics" && (
          <div className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
            {music.lyric || "No lyrics available"}
          </div>
        )}

        {activeTab === "diary" && (
          <div>
            {music.diaryTitle && (
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
                {music.diaryTitle}
              </h2>
            )}
            <div className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
              {music.diaryContent || "No diary entry available"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function MusicDetail() {
  const { musicId } = useParams<{ musicId: string }>();

  if (!musicId) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-slate-500 dark:text-slate-400">Invalid music ID</p>
      </div>
    );
  }

  return (
    <ConvexQueryBoundary>
      <MusicDetailContent musicId={musicId as Id<"music">} />
    </ConvexQueryBoundary>
  );
}
