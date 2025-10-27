import React from 'react';
import { MusicEmbed } from '../components/MarkdownComponents';

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
