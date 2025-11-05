import { useQuery } from "convex/react";
import { api } from "@backend/convex";
import { MusicCard } from "./MusicCard";
import ConvexQueryBoundary from "./ConvexQueryBoundary";
import Empty from "./Empty";
import { usePlaylist } from "../hooks/usePlaylist";
import type { Id } from "@backend/convex/convex/_generated/dataModel";

interface MusicTrack {
  _id: Id<"music">;
  diaryId?: Id<"diaries">;
  title?: string;
  imageUrl?: string;
  audioUrl?: string;
  duration?: number;
  lyric?: string;
  status: "pending" | "ready" | "failed";
  createdAt: number;
  updatedAt: number;
  diaryDate?: number;
  diaryContent?: string;
  diaryTitle?: string;
}

function MusicListContent({ music }: { music: MusicTrack[] }) {
  const { playTrack, setPlaylist } = usePlaylist();

  if (!music || music.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Empty />
        <p className="mt-4 text-slate-500 dark:text-slate-400 text-center">
          No music yet. Create a diary entry to generate your first song!
        </p>
      </div>
    );
  }

  const handlePlay = (index: number) => {
    // Set the entire playlist
    setPlaylist(music);
    // Play the specific track
    playTrack(index);
  };

  return (
    <div className="max-w-4xl">
      {music.map((track, index) => (
        <div key={track._id} className={index !== music.length - 1 ? "border-b border-slate-200 dark:border-slate-700" : ""}>
          <MusicCard
            musicId={track._id}
            title={track.title}
            imageUrl={track.imageUrl}
            diaryContent={track.diaryContent}
            diaryDate={track.diaryDate}
            status={track.status}
            onPlay={() => handlePlay(index)}
          />
        </div>
      ))}
    </div>
  );
}

export function MusicList() {
  const music = useQuery(api.music.listPlaylistMusic);

  return (
    <ConvexQueryBoundary queries={[{ data: music }]}>
      <MusicListContent music={music || []} />
    </ConvexQueryBoundary>
  );
}
