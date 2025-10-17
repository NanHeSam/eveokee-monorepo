import { useCallback } from 'react';
import { Share, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useMutation } from 'convex/react';
import { api } from '@eveokee/backend';
import { Id } from '@eveokee/backend/convex/_generated/dataModel';

export const useShareMusic = () => {
  const createShareLink = useMutation(api.sharing.createShareLink);

  const shareMusic = useCallback(async (musicId: Id<"music">, title: string) => {
    try {
      const result = await createShareLink({ musicId });
      
      try {
        await Share.share({
          title: `Check out "${title}" on Eveokee`,
          message: `Check out "${title}" on Eveokee!\n\n${result.shareUrl}`,
          url: result.shareUrl,
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
