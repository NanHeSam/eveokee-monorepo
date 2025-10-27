import React from 'react';
import { MusicEmbed } from '../components/MarkdownComponents';

// Custom markdown components for react-markdown
export const markdownComponents = {
  // Custom component for music embeds
  music: MusicEmbed,
};

// Helper function to parse music shortcodes in markdown
export const parseMusicShortcodes = (content: string): string => {
  // Simple regex to match [music:id title="Title" duration="3:24"]
  const musicRegex = /\[music:([^\s\]]+)([^\]]*)\]/g;

  // Reset regex
  musicRegex.lastIndex = 0;

  const result = content.replace(musicRegex, (fullMatch, id, attributes) => {
    // Extract attributes from the attributes string
    const titleMatch = attributes.match(/title="([^"]*)"/);
    const durationMatch = attributes.match(/duration="([^"]*)"/);
    const srcMatch = attributes.match(/src="([^"]*)"/);

    const title = titleMatch ? titleMatch[1] : '';
    const duration = durationMatch ? durationMatch[1] : '3:24';
    const src = srcMatch ? srcMatch[1] : '';

    // Create a unique placeholder that we can replace with React components
    const musicData = JSON.stringify({ id, title, duration, src });
    const placeholder = `__MUSIC_COMPONENT__${musicData}__END_MUSIC__`;
    return placeholder;
  });

  return result;
};

// Helper function to process the content and replace music placeholders with React components
export const processMusicComponents = (content: string): (string | React.ReactElement)[] => {
  const parts = content.split(/(__MUSIC_COMPONENT__.*?__END_MUSIC__)/);

  return parts.map((part, index) => {
    if (part.startsWith('__MUSIC_COMPONENT__') && part.endsWith('__END_MUSIC__')) {
      const jsonStr = part.replace('__MUSIC_COMPONENT__', '').replace('__END_MUSIC__', '');
      try {
        const musicData = JSON.parse(jsonStr);
        const musicComponent = (
          <MusicEmbed
            key={`music-${index}`}
            id={musicData.id}
            title={musicData.title}
            duration={musicData.duration}
            src={musicData.src}
          />
        );
        return musicComponent;
      } catch (e) {
        console.error('Failed to parse music component data');
        return '[Music unavailable]';
      }
    }
    return part;
  });
};
