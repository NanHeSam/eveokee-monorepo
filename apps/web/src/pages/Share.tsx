import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@eveokee/backend";
import MusicPlayer from "@/components/MusicPlayer";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";

const formatDuration = (seconds?: number): string => {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export default function Share() {
  const { shareId } = useParams<{ shareId: string }>();
  const sharedMusic = useQuery(api.sharing.getSharedMusic, shareId ? { shareId } : "skip");
  const recordShareView = useMutation(api.sharing.recordShareView);
  const hasRecordedViewRef = useRef(false);

  // Check if view has already been recorded in this session
  const hasRecordedViewInSession = (shareId: string): boolean => {
    if (typeof window === "undefined") return false;
    try {
      const recordedViews = JSON.parse(sessionStorage.getItem("recordedShareViews") || "[]");
      return recordedViews.includes(shareId);
    } catch {
      return false;
    }
  };

  // Mark view as recorded in this session
  const markViewAsRecorded = (shareId: string): void => {
    if (typeof window === "undefined") return;
    try {
      const recordedViews = JSON.parse(sessionStorage.getItem("recordedShareViews") || "[]");
      if (!recordedViews.includes(shareId)) {
        recordedViews.push(shareId);
        sessionStorage.setItem("recordedShareViews", JSON.stringify(recordedViews));
      }
    } catch (error) {
      console.warn("Failed to mark view as recorded in session storage:", error);
    }
  };

  useEffect(() => {
    hasRecordedViewRef.current = false;
  }, [shareId]);

  useEffect(() => {
    if (!shareId || !sharedMusic?.found || hasRecordedViewRef.current) {
      return;
    }

    // Check if we've already recorded a view for this shareId in this session
    if (hasRecordedViewInSession(shareId)) {
      return;
    }

    hasRecordedViewRef.current = true;

    recordShareView({ shareId }).then(() => {
      // Mark as recorded in session storage only after successful recording
      markViewAsRecorded(shareId);
    }).catch((error) => {
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
            Go to Eveokee
          </a>
        </div>
      </div>
    );
  }

  const shareUrl = typeof window !== "undefined" 
    ? `${window.location.protocol}//${window.location.host}${window.location.pathname}`
    : "";

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: sharedMusic.title,
          text: `Check out this music from Eveokee: ${sharedMusic.title}`,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled the share dialog - this is normal behavior
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Error sharing:", error);
          toast.error("Failed to share");
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied to clipboard!");
      } catch (error) {
        console.error("Error copying to clipboard:", error);
        toast.error("Failed to copy link");
      }
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="lg:grid lg:grid-cols-2 lg:gap-8 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden">
          {sharedMusic.imageUrl && (
            <div className="relative w-full aspect-square lg:aspect-[3/4] overflow-hidden">
              <img
                src={sharedMusic.imageUrl}
                alt={sharedMusic.title}
                className="w-full h-full object-cover"
              />
              {/* Tainted glass overlay */}
              <div className="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
              
              {/* Lyrics overlay */}
              {sharedMusic.lyric && (
                <div className="absolute inset-0 flex items-center justify-center p-6 lg:p-8">
                  <div className="text-center max-h-full overflow-y-auto scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent">
                    <p className="text-white text-base sm:text-lg lg:text-xl font-medium leading-relaxed whitespace-pre-line drop-shadow-lg">
                      {sharedMusic.lyric}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="p-6 lg:p-8 flex flex-col justify-center">
            <div className="max-w-lg mx-auto lg:mx-0 text-center lg:text-left">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {sharedMusic.title}
              </h1>

              {sharedMusic.userName && (
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                  by {sharedMusic.userName}
                </p>
              )}

              <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
                Shared {(() => {
                  try {
                    return formatDistanceToNow(new Date(sharedMusic.createdAt), { addSuffix: true });
                  } catch {
                    return 'recently';
                  }
                })()}
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
                  Get Eveokee
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Create your own music diary. Turn your thoughts into personalized songs.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center">
                  <a 
                    href="https://apps.apple.com/app/eveokee"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition-opacity"
                  >
                    <img 
                      src="/app-store-badge.svg"
                      alt="Download on the App Store"
                      className="h-[60px] w-auto"
                    />
                  </a>
                  <a 
                    href="https://play.google.com/store/apps/details?id=com.eveokee"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition-opacity"
                  >
                    <img 
                      src="/google-play-badge.svg"
                      alt="Get it on Google Play"
                      className="h-[60px] w-auto"
                    />
                  </a>
                  <button
                    onClick={handleShare}
                    className="inline-flex items-center justify-center px-6 py-4 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors whitespace-nowrap"
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
        </div>
      </div>
    </div>
  );
}
