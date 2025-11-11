import React from 'react';
import { MusicEmbed, YouTubeEmbed } from '../components/MarkdownComponents';

// Custom markdown components for react-markdown
export const markdownComponents = {
  // Custom component for music embeds
  music: MusicEmbed,
};

// Helper function to parse YouTube embeds from HTML divs
export const parseYouTubeEmbeds = (content: string): string => {
  // Match <div data-youtube-video> with iframe inside (handles multiline iframes)
  // This regex matches the div and extracts the video ID and title from the iframe
  // Attributes can appear in any order, so we capture the iframe tag content and parse separately
  const youtubeRegex = /<div\s+data-youtube-video[^>]*>[\s\S]*?(<iframe[\s\S]*?<\/iframe>)[\s\S]*?<\/div>/gi;
  
  return content.replace(youtubeRegex, (fullMatch, iframeTag) => {
    // Extract video ID from src attribute or data-youtube-video-id attribute
    const videoIdMatch = iframeTag.match(/(?:src=["']https?:\/\/(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)|data-youtube-video-id=["']([a-zA-Z0-9_-]+))/i);
    const videoId = videoIdMatch ? (videoIdMatch[1] || videoIdMatch[2]) : null;
    
    if (!videoId) {
      return fullMatch; // Return original if no video ID found
    }
    
    // Extract title from title attribute or data-title attribute (can appear anywhere in iframe tag)
    const titleMatch = iframeTag.match(/(?:title=["']([^"']*)["']|data-title=["']([^"']*)["'])/i);
    const title = titleMatch ? (titleMatch[1] || titleMatch[2]) : undefined;
    
    // Create a unique placeholder that we can replace with React components
    const youtubeData = JSON.stringify({ videoId, ...(title && { title }) });
    const placeholder = `__YOUTUBE_COMPONENT__${youtubeData}__END_YOUTUBE__`;
    return placeholder;
  });
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

// Helper function to process the content and replace placeholders with React components
export const processMusicComponents = (content: string): (string | React.ReactElement)[] => {
  // First process YouTube embeds, then music components
  const parts = content.split(/(__MUSIC_COMPONENT__.*?__END_MUSIC__|__YOUTUBE_COMPONENT__.*?__END_YOUTUBE__)/);

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
        console.error('Failed to parse music component data:', e);
        return '[Music unavailable]';
      }
    } else if (part.startsWith('__YOUTUBE_COMPONENT__') && part.endsWith('__END_YOUTUBE__')) {
      const jsonStr = part.replace('__YOUTUBE_COMPONENT__', '').replace('__END_YOUTUBE__', '');
      try {
        const youtubeData = JSON.parse(jsonStr);
        const youtubeComponent = (
          <YouTubeEmbed
            key={`youtube-${index}`}
            videoId={youtubeData.videoId}
            title={youtubeData.title}
          />
        );
        return youtubeComponent;
      } catch (e) {
        console.error('Failed to parse YouTube component data:', e);
        return '[YouTube video unavailable]';
      }
    }
    return part;
  });
};



