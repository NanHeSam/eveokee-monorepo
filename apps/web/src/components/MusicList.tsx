import { useQuery } from "convex/react";
import { api } from "@backend/convex";
import { MusicCard } from "./MusicCard";
import ConvexQueryBoundary from "./ConvexQueryBoundary";
import Empty from "./Empty";
import { usePlaylist } from "../hooks/usePlaylist";

function MusicListContent({ music }: { music: any[] }) {
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 py-6">
      {music.map((track, index) => (
        <MusicCard
          key={track._id}
          musicId={track._id}
          title={track.title}
          imageUrl={track.imageUrl}
          diaryContent={track.diaryContent}
          diaryDate={track.diaryDate}
          status={track.status}
          onPlay={() => handlePlay(index)}
        />
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
