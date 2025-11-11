import React from 'react';
import MusicPlayer from './MusicPlayer';

interface MusicEmbedProps {
  src?: string;
  title: string;
  duration?: string;
  id: string;
}

export const MusicEmbed: React.FC<MusicEmbedProps> = ({
  src = 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
  title,
  duration = '3:24',
  id
}) => {
  return (
    <div className="my-8 p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-3 h-3 bg-accent-mint rounded-full"></div>
        <h4 className="text-lg font-semibold text-gray-800 dark:text-white">🎧 {title}</h4>
      </div>
      <MusicPlayer
        audioId={id}
        audioUrl={src}
        duration={duration}
        className="w-full"
      />
      <p className="text-sm text-gray-600 dark:text-gray-300 mt-3 italic">
        Click play to listen to this song that captures the essence of this moment.
      </p>
    </div>
  );
};

interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
}

export const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({ videoId, title }) => {
  return (
    <div className="my-8">
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <iframe
          className="absolute top-0 left-0 w-full h-full rounded-lg"
          src={`https://www.youtube.com/embed/${videoId}`}
          title={title ?? `YouTube video player: ${videoId}`}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  );
};