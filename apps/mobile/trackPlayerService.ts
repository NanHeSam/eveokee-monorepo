import TrackPlayer, { Event } from 'react-native-track-player';

const PlaybackService = async () => {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.play().catch((error) => {
      console.error('Remote play failed', error);
    });
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

