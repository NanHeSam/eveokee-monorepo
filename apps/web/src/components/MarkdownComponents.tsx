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

// Custom markdown components for react-markdown
export const markdownComponents = {
  // Custom component for music embeds
  music: MusicEmbed,
};

// Helper function to parse music shortcodes in markdown
export const parseMusicShortcodes = (content: string): string => {
  console.log('Original content:', content);
  console.log('Content length:', content.length);
  console.log('Looking for music shortcodes...');
  
  // Check if content contains the music shortcode
  const hasMusic = content.includes('[music:');
  console.log('Content contains [music:?', hasMusic);
  
  if (hasMusic) {
    const musicIndex = content.indexOf('[music:');
    const contextStart = Math.max(0, musicIndex - 50);
    const contextEnd = Math.min(content.length, musicIndex + 150);
    console.log('Music shortcode context:', content.substring(contextStart, contextEnd));
  }
  
  // Simple regex to match [music:id title="Title" duration="3:24"]
  const musicRegex = /\[music:([^\s\]]+)([^\]]*)\]/g;
  
  const matches = [];
  let match;
  while ((match = musicRegex.exec(content)) !== null) {
    matches.push(match);
  }
  console.log('Found matches:', matches);
  
  // Reset regex
  musicRegex.lastIndex = 0;
  
  const result = content.replace(musicRegex, (fullMatch, id, attributes) => {
    console.log('Processing match:', { fullMatch, id, attributes });
    
    // Extract attributes from the attributes string
    const titleMatch = attributes.match(/title="([^"]*)"/);
    const durationMatch = attributes.match(/duration="([^"]*)"/);
    const srcMatch = attributes.match(/src="([^"]*)"/);
    
    const title = titleMatch ? titleMatch[1] : '';
    const duration = durationMatch ? durationMatch[1] : '3:24';
    const src = srcMatch ? srcMatch[1] : '';
    
    console.log('Extracted attributes:', { id, title, duration, src });
    
    // Create a unique placeholder that we can replace with React components
    const musicData = JSON.stringify({ id, title, duration, src });
    const placeholder = `__MUSIC_COMPONENT__${musicData}__END_MUSIC__`;
    console.log('Created placeholder:', placeholder);
    return placeholder;
  });
  
  console.log('Processed content:', result);
  return result;
};

// Helper function to process the content and replace music placeholders with React components
export const processMusicComponents = (content: string): (string | React.ReactElement)[] => {
  console.log('Processing music components for content:', content);
  const parts = content.split(/(__MUSIC_COMPONENT__.*?__END_MUSIC__)/);
  console.log('Split parts:', parts);
  
  return parts.map((part, index) => {
    if (part.startsWith('__MUSIC_COMPONENT__') && part.endsWith('__END_MUSIC__')) {
      console.log('Found music component part:', part);
      const jsonStr = part.replace('__MUSIC_COMPONENT__', '').replace('__END_MUSIC__', '');
      try {
        const musicData = JSON.parse(jsonStr);
        console.log('Parsed music data:', musicData);
        const musicComponent = (
          <MusicEmbed
            key={`music-${index}`}
            id={musicData.id}
            title={musicData.title}
            duration={musicData.duration}
            src={musicData.src}
          />
        );
        console.log('Created music component:', musicComponent);
        return musicComponent;
      } catch (e) {
        console.error('Error parsing music data:', e);
        return part; // Return original if parsing fails
      }
    }
    return part;
  });
};