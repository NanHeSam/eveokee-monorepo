import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@diary-vibes/backend";
import MusicPlayer from "@/components/MusicPlayer";
import { formatDistanceToNow } from "date-fns";

export default function Share() {
  const { shareId } = useParams<{ shareId: string }>();
  const sharedMusic = useQuery(api.sharing.getSharedMusic, shareId ? { shareId } : "skip");
  const recordShareView = useMutation(api.sharing.recordShareView);
  const hasRecordedViewRef = useRef(false);

  useEffect(() => {
    hasRecordedViewRef.current = false;
  }, [shareId]);

  useEffect(() => {
    if (!shareId || !sharedMusic?.found || hasRecordedViewRef.current) {
      return;
    }

    hasRecordedViewRef.current = true;

    recordShareView({ shareId }).catch((error) => {
      console.error("Error recording share view:", error);
      hasRecordedViewRef.current = false;
    });
  }, [shareId, sharedMusic?.found, recordShareView]);

  if (!shareId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Invalid Share Link
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            The share link you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  if (sharedMusic === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-gray-100 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!sharedMusic.found) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center max-w-md px-6">
          <div className="text-6xl mb-4">🎵</div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            Music Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            This music may have been removed or the share link is no longer active.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-full font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
          >
            Go to DiaryVibes
          </a>
        </div>
      </div>
    );
  }

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: sharedMusic.title,
          text: `Check out this music from DiaryVibes: ${sharedMusic.title}`,
          url: shareUrl,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("Link copied to clipboard!");
      } catch (error) {
        console.error("Error copying to clipboard:", error);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">

        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden">
          {sharedMusic.imageUrl && (
            <div className="relative w-full h-96 overflow-hidden">
              <img
                src={sharedMusic.imageUrl}
                alt={sharedMusic.title}
                className="w-full h-full object-cover"
              />
              {/* Tainted glass overlay */}
              <div className="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
              
              {/* Lyrics overlay */}
              {sharedMusic.lyric && (
                <div className="absolute inset-0 flex items-center justify-center p-8">
                  <div className="text-center max-h-full overflow-y-auto scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent">
                    <p className="text-white text-lg sm:text-xl font-medium leading-relaxed whitespace-pre-line drop-shadow-lg">
                      {sharedMusic.lyric}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="p-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {sharedMusic.title}
            </h1>

            {sharedMusic.userName && (
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                by {sharedMusic.userName}
              </p>
            )}

            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
              Shared {formatDistanceToNow(new Date(sharedMusic.createdAt), { addSuffix: true })}
            </p>

            {sharedMusic.audioUrl && (
              <div className="mb-8">
                <MusicPlayer
                  audioId={shareId}
                  audioUrl={sharedMusic.audioUrl}
                  duration={formatDuration(sharedMusic.duration)}
                  className="w-full"
                />
              </div>
            )}

            {/* Show lyrics below if no image, or as a separate section if image exists */}
            {sharedMusic.lyric && !sharedMusic.imageUrl && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Lyrics
                </h2>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-6">
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                    {sharedMusic.lyric}
                  </p>
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Get DiaryVibes
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Create your own music diary. Turn your thoughts into personalized songs.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="https://apps.apple.com/app/diaryvibes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  App Store
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=com.diaryvibes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                  </svg>
                  Google Play
                </a>
              </div>

              <div className="mt-6">
                <button
                  onClick={handleShare}
                  className="w-full inline-flex items-center justify-center px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share This Music
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-8 text-sm text-gray-500 dark:text-gray-500">
          <p>© {new Date().getFullYear()} DiaryVibes. All rights reserved.</p>
        </div>
      </div>
  );
}
