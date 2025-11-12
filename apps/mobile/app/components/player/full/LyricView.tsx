import { ActivityIndicator, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useMemo, useState } from 'react';

import { useThemeColors } from '../../../theme/useThemeColors';

/**
 * LyricView Component
 *
 * Displays lyrics and artwork with optional video generation CTA.
 * Has two distinct modes controlled by showArtwork prop.
 *
 * Modes:
 * 1. Artwork Mode (showArtwork=true):
 *    - Shows artwork (32% of screen height, rounded-3xl)
 *    - Optional "Generate Video" button below artwork
 *    - Artwork pressable to toggle overlay (if onPressArtwork provided)
 *
 * 2. Overlay Mode (showArtwork=false):
 *    - Full-screen scrollable lyrics with large text (24px, line-height 34px)
 *    - Lyrics pressable to toggle back to artwork mode
 *    - Used when overlay is visible in LyricsPlayerView
 *
 * Video Generation CTA:
 * - Only shown when !hasVideo && onGenerateVideo provided
 * - Shows loading state while isGenerating
 * - Disabled state when !canGenerate (insufficient credits)
 * - Button text includes credit cost (3) and remaining credits
 *
 * Implicit Behaviors:
 * - Artwork size dynamically calculated as 32% of screen height
 * - Fallback musical-notes icon shown when no artwork available
 * - event.stopPropagation() prevents tap-through on artwork/buttons
 * - Lyrics text shadow for better readability over varied backgrounds
 */

interface LyricViewProps {
  artwork?: string | null;
  lyrics?: string | null;
  /** Timed lyrics with word-level timestamps for karaoke-style display */
  lyricWithTime?: {
    alignedWords: {
      word: string;
      startS: number;
      endS: number;
      palign: number;
    }[];
    waveformData: number[];
    hootCer: number;
  };
  /** Current playback position in seconds */
  position?: number;
  /** Callback to toggle between artwork and overlay modes */
  onPressArtwork?: () => void;
  /** Show artwork or full-screen scrollable lyrics */
  showArtwork?: boolean;
  /** Whether video already exists (hides generate button) */
  hasVideo?: boolean;
  /** Callback to generate video */
  onGenerateVideo?: () => void;
  /** Whether video is currently generating */
  isGenerating?: boolean;
  /** Elapsed time in seconds since video generation started */
  pendingElapsedSeconds?: number | null;
  /** Whether user has enough credits to generate */
  canGenerate?: boolean;
  /** Remaining video generation credits */
  remainingCredits?: number;
}

export const LyricView = ({
  artwork,
  lyrics,
  lyricWithTime,
  position = 0,
  onPressArtwork,
  showArtwork = true,
  hasVideo = false,
  onGenerateVideo,
  isGenerating = false,
  pendingElapsedSeconds = null,
  canGenerate = false,
  remainingCredits = 0,
}: LyricViewProps) => {
  const colors = useThemeColors();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  const lastValidWordIndexRef = useRef<number>(-1);
  const lastScrollIndexRef = useRef<number>(-1);
  const textContainerRef = useRef<View | null>(null);
  const [textContainerHeight, setTextContainerHeight] = useState<number>(0);
  const sentenceLayoutsRef = useRef<Map<number, { y: number; height: number }>>(new Map());
  const HARD_SYNC_OFFSET = 1.0;
  const [syncOffset, setSyncOffset] = useState(HARD_SYNC_OFFSET);
  
  // Get actual font metrics from styles
  const fontSize = 24; // From styles.overlayText.fontSize
  const lineHeight = 34; // From styles.overlayText.lineHeight

  // Reset last valid index and measurements when track changes
  useEffect(() => {
    lastValidWordIndexRef.current = -1;
    lastScrollIndexRef.current = -1;
    setTextContainerHeight(0);
    sentenceLayoutsRef.current.clear();
    setSyncOffset(HARD_SYNC_OFFSET);
  }, [lyricWithTime]);

  // Group words into sentences based on punctuation and natural pauses
  const sentences = useMemo(() => {
    if (!lyricWithTime?.alignedWords) return [];
    
    const words = lyricWithTime.alignedWords;
    const sentenceGroups: { startIndex: number; endIndex: number; startTime: number; endTime: number }[] = [];
    let currentSentenceStart = 0;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const isSentenceEnd = /[.!?]$/.test(word.word.trim());
      const isLastWord = i === words.length - 1;
      
      // Check for natural pause (gap > 0.5s between words)
      const hasPause = i > 0 && (word.startS - words[i - 1].endS) > 0.5;
      
      if (isSentenceEnd || isLastWord || hasPause) {
        sentenceGroups.push({
          startIndex: currentSentenceStart,
          endIndex: i,
          startTime: words[currentSentenceStart].startS,
          endTime: word.endS,
        });
        currentSentenceStart = i + 1;
      }
    }
    
    return sentenceGroups;
  }, [lyricWithTime]);

  // Find the current sentence and calculate progress through it
  const sentenceProgress = useMemo(() => {
    if (!lyricWithTime?.alignedWords || position === undefined || sentences.length === 0) {
      return { currentSentenceIndex: -1, progress: 0, currentWordIndex: -1 };
    }
    const adjustedPosition = position + syncOffset;
    const words = lyricWithTime.alignedWords;
    
    // Find which sentence we're in
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      
      // Check if we're within this sentence's time range
      if (adjustedPosition >= sentence.startTime && adjustedPosition <= sentence.endTime) {
        // Calculate progress through the sentence (0-1)
        const sentenceDuration = sentence.endTime - sentence.startTime;
        const elapsedInSentence = adjustedPosition - sentence.startTime;
        const progress = Math.max(0, Math.min(1, elapsedInSentence / sentenceDuration));
        
        // Find current word index within sentence
        let currentWordIndex = -1;
        for (let j = sentence.startIndex; j <= sentence.endIndex; j++) {
          if (adjustedPosition >= words[j].startS && adjustedPosition < words[j].endS) {
            currentWordIndex = j;
            break;
          }
        }
        // Fallback: if between words, use last word that has started
        if (currentWordIndex === -1) {
          for (let j = sentence.endIndex; j >= sentence.startIndex; j--) {
            if (adjustedPosition >= words[j].startS) {
              currentWordIndex = j;
              break;
            }
          }
        }
        
        lastValidWordIndexRef.current = currentWordIndex >= 0 ? currentWordIndex : sentence.endIndex;
        return { currentSentenceIndex: i, progress, currentWordIndex: lastValidWordIndexRef.current };
      }
      
      // If we've passed this sentence, mark it as complete
      if (adjustedPosition > sentence.endTime) {
        lastValidWordIndexRef.current = sentence.endIndex;
      }
    }
    
    // If before first sentence
    if (sentences.length > 0 && adjustedPosition < sentences[0].startTime) {
      return { currentSentenceIndex: -1, progress: 0, currentWordIndex: -1 };
    }
    
    // If past last sentence
    if (sentences.length > 0 && adjustedPosition > sentences[sentences.length - 1].endTime) {
      lastValidWordIndexRef.current = words.length - 1;
      return { 
        currentSentenceIndex: sentences.length - 1, 
        progress: 1, 
        currentWordIndex: words.length - 1 
      };
    }
    
    let fallbackSentenceIndex = -1;
    if (lastValidWordIndexRef.current >= 0) {
      for (let i = 0; i < sentences.length; i++) {
        const s = sentences[i];
        if (lastValidWordIndexRef.current >= s.startIndex && lastValidWordIndexRef.current <= s.endIndex) {
          fallbackSentenceIndex = i;
          break;
        }
      }
    }
    return {
      currentSentenceIndex: fallbackSentenceIndex,
      progress: 0,
      currentWordIndex: lastValidWordIndexRef.current,
    };
  }, [lyricWithTime, position, sentences, syncOffset]);

  // Measure text container to get actual dimensions
  const handleTextContainerLayout = (event: any) => {
    const { height } = event.nativeEvent.layout;
    setTextContainerHeight(height);
  };

  // Auto-scroll to keep current word visible and centered
  useEffect(() => {
    const { currentSentenceIndex, currentWordIndex, progress } = sentenceProgress;
    const shouldScroll = currentWordIndex >= 0 && currentWordIndex !== lastScrollIndexRef.current && textContainerHeight > 0;
    if (shouldScroll && scrollViewRef.current && lyricWithTime?.alignedWords) {
      lastScrollIndexRef.current = currentWordIndex;
      const timeoutId = setTimeout(() => {
        if (!scrollViewRef.current || textContainerHeight === 0) return;
        const layout = sentenceLayoutsRef.current.get(currentSentenceIndex);
        if (layout) {
          const desiredTop = screenHeight * 0.3;
          const targetScrollY = Math.max(0, layout.y + (progress * layout.height) - desiredTop);
          scrollViewRef.current.scrollTo({ y: targetScrollY, animated: true });
        } else {
          const availableWidth = screenWidth - 48;
          const avgCharWidth = fontSize * 0.7;
          const avgWordWidth = avgCharWidth * 8;
          const calculatedWordsPerLine = Math.floor(availableWidth / avgWordWidth);
          const wordsPerLine = Math.max(2, calculatedWordsPerLine - 1);
          const currentWordLine = currentWordIndex / wordsPerLine;
          const lineHeightWithSpacing = lineHeight + 4;
          const estimatedY = currentWordLine * lineHeightWithSpacing + 16;
          const desiredTop = screenHeight * 0.3;
          const targetScrollY = Math.max(0, estimatedY - desiredTop);
          scrollViewRef.current.scrollTo({ y: targetScrollY, animated: true });
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [sentenceProgress, screenHeight, screenWidth, textContainerHeight, lyricWithTime, fontSize, lineHeight]);

  

  // Render timed lyrics with sentence-based rolling highlight
  const renderTimedLyrics = () => {
    if (!lyricWithTime?.alignedWords) {
      return null;
    }

    const words = lyricWithTime.alignedWords;
    const { currentSentenceIndex, currentWordIndex } = sentenceProgress;
    const textColor = colors.scheme === 'dark' ? 'rgba(255,255,255,0.96)' : 'rgba(12,12,12,0.88)';
    const highlightedColor = colors.accentMint;

    return (
      <View
        ref={(ref) => {
          textContainerRef.current = ref;
        }}
        onLayout={handleTextContainerLayout}
      >
        {sentences.map((s, si) => (
          <View
            key={si}
            onLayout={(e) => {
              const { y, height } = e.nativeEvent.layout;
              sentenceLayoutsRef.current.set(si, { y, height });
            }}
          >
            <Text
              style={[
                styles.overlayText,
                {
                  color: textColor,
                },
              ]}
            >
              {words.slice(s.startIndex, s.endIndex + 1).map((word, localIdx) => {
                const index = s.startIndex + localIdx;
                const isSentenceComplete = si < currentSentenceIndex;
                const isCurrentSentence = si === currentSentenceIndex && currentSentenceIndex >= 0;
                const shouldHighlight = isSentenceComplete || (isCurrentSentence && index <= currentWordIndex && currentWordIndex >= 0);
                const isCurrent = index === currentWordIndex && currentWordIndex >= 0;
                const wordColor = shouldHighlight ? highlightedColor : textColor;
                const fontWeight = isCurrent ? '700' : shouldHighlight ? '600' : '600';
                return (
                  <Text
                    key={index}
                    style={{
                      color: wordColor,
                      fontWeight,
                    }}
                  >
                    {word.word}
                    {index < words.length - 1 ? ' ' : ''}
                  </Text>
                );
              })}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // Fallback to plain text lyrics
  const overlayText = (
    <Text
      className="text-center"
      style={[
        styles.overlayText,
        {
          color: colors.scheme === 'dark' ? 'rgba(255,255,255,0.96)' : 'rgba(12,12,12,0.88)',
        },
      ]}
    >
      {lyrics}
    </Text>
  );

  if (!showArtwork) {
    const hasTimedLyrics = lyricWithTime?.alignedWords && lyricWithTime.alignedWords.length > 0;
    
    return (
      <View style={styles.overlayContainer}>
        {hasTimedLyrics ? (
          <ScrollView
            ref={scrollViewRef}
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16 }}
            scrollEnabled={true}
          >
            <Pressable onPress={onPressArtwork}>
              {renderTimedLyrics()}
            </Pressable>
          </ScrollView>
        ) : lyrics ? (
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16 }}
          >
            <Pressable onPress={onPressArtwork}>{overlayText}</Pressable>
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center p-6">
            <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
            <Text className="mt-3 text-base" style={{ color: colors.textMuted }}>
              No lyrics available
            </Text>
          </View>
        )}
      </View>
    );
  }

  const renderArtwork = () => {
    const artworkSize = screenHeight * 0.32;

    if (!artwork) {
      return (
        <View
          className="items-center justify-center rounded-3xl"
          style={{
            width: artworkSize,
            height: artworkSize,
            backgroundColor: colors.surface,
          }}
        >
          <Ionicons name="musical-notes" size={80} color={colors.textSecondary} />
        </View>
      );
    }

    const artworkContent = (
      <ImageBackground
        source={{ uri: artwork }}
        style={[styles.artwork, { width: artworkSize, height: artworkSize }]}
        imageStyle={styles.artworkImage}
        resizeMode="cover"
      />
    );

    if (!onPressArtwork) {
      return artworkContent;
    }

    return (
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          onPressArtwork();
        }}
        className="rounded-3xl"
      >
        {artworkContent}
      </Pressable>
    );
  };

  const renderGenerateVideoButton = () => {
    if (hasVideo || !onGenerateVideo) {
      return null;
    }

    if (isGenerating) {
      return (
        <View
          className="flex-row items-center justify-center rounded-full px-6 py-3 mt-4"
          style={{ backgroundColor: colors.surface }}
        >
          <ActivityIndicator size="small" color={colors.accentMint} />
          <Text className="ml-2 text-sm font-medium" style={{ color: colors.textSecondary }}>
            Generating video{pendingElapsedSeconds !== null ? ` • ${pendingElapsedSeconds}s elapsed` : '...'}
          </Text>
        </View>
      );
    }

    return (
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          onGenerateVideo();
        }}
        disabled={!canGenerate}
        className="flex-row items-center justify-center rounded-full px-6 py-3 mt-4"
        style={{ backgroundColor: canGenerate ? colors.accentMint : colors.surface }}
      >
        <Ionicons name="videocam" size={20} color={canGenerate ? colors.background : colors.textMuted} style={{ marginRight: 8 }} />
        <Text className="text-base font-semibold" style={{ color: canGenerate ? colors.background : colors.textMuted }}>
          Generate Video (3 credits){remainingCredits > 0 ? ` • ${remainingCredits} left` : ''}
        </Text>
      </Pressable>
    );
  };

  return (
    <View className="flex-1" style={styles.container}>
      <View className="items-center" style={styles.artworkWrapper}>
        {renderArtwork()}
        {renderGenerateVideoButton()}
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  artwork: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  artworkImage: {
    borderRadius: 24,
  },
  container: {
    gap: 24,
  },
  artworkWrapper: {
    paddingTop: 16,
  },
  overlayContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  overlayText: {
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
