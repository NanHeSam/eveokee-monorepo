import { useCallback } from 'react';
import { Share, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useMutation } from 'convex/react';
import { api } from '@backend/convex';
import { Id } from '@backend/convex/convex/_generated/dataModel';

// Default share base URL - matches backend constant
const DEFAULT_SHARE_BASE_URL = "https://eveokee.com";

export const useShareMusic = () => {
  const createShareLink = useMutation(api.sharing.createShareLink);

  const shareMusic = useCallback(async (musicId: Id<"music">, title: string, shareId?: string) => {
    try {
      let shareUrl: string;
      
      // If shareId is provided (for shared songs), use existing share link
      if (shareId) {
        shareUrl = `${DEFAULT_SHARE_BASE_URL}/share/${shareId}`;
      } else {
        // Otherwise, create a new share link
        const result = await createShareLink({ musicId });
        shareUrl = result.shareUrl;
      }
      
      try {
        await Share.share({
          title: `Check out "${title}" on eveokee`,
          message: `Check out "${title}" on eveokee!\n\n${shareUrl}`,
          url: shareUrl,
        });
      } catch (shareError: any) {
        if (shareError.message !== 'User did not share') {
          console.error('Share error:', shareError);
        }
      }
    } catch (error) {
      console.error('Failed to create share link:', error);
      Alert.alert('Error', 'Failed to create share link. Please try again.');
    }
  }, [createShareLink]);

  const copyShareLink = useCallback(async (musicId: Id<"music">) => {
    try {
      const result = await createShareLink({ musicId });
      await Clipboard.setStringAsync(result.shareUrl);
      Alert.alert('Copied!', 'Share link copied to clipboard');
    } catch (error) {
      console.error('Failed to copy share link:', error);
      Alert.alert('Error', 'Failed to copy share link. Please try again.');
    }
  }, [createShareLink]);

  return { shareMusic, copyShareLink };
};
