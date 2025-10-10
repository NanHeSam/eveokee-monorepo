import TrackPlayer, { Event } from 'react-native-track-player';

const PlaybackService = async () => {
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    try {
      const queue = await TrackPlayer.getQueue();
      const activeIndex = await TrackPlayer.getActiveTrackIndex();

      if (queue.length > 0) {
        if (activeIndex === null || activeIndex === undefined) {
          // Fresh queue with no active track - activate first track
          await TrackPlayer.skip(0);
        }
        await TrackPlayer.play();
      }
    } catch (error) {
      console.error('Remote play failed', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause().catch((error) => {
      console.error('Remote pause failed', error);
    });
  });

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    TrackPlayer.skipToNext().catch(() => {
      // No-op: queue is single track for now
    });
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    TrackPlayer.skipToPrevious().catch(() => {
      // No-op: queue is single track for now
    });
  });
};

export default PlaybackService;

