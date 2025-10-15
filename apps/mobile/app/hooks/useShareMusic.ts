import { useCallback } from 'react';
import { Share, Alert, Clipboard } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '@diary-vibes/backend';
import { Id } from '@diary-vibes/backend/convex/_generated/dataModel';

export const useShareMusic = () => {
  const createShareLink = useMutation(api.sharing.createShareLink);

  const shareMusic = useCallback(async (musicId: Id<"music">, title: string) => {
    try {
      const result = await createShareLink({ musicId });
      
      try {
        await Share.share({
          title: `Check out "${title}" on DiaryVibes`,
          message: `Check out "${title}" on DiaryVibes!\n\n${result.shareUrl}`,
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
      Clipboard.setString(result.shareUrl);
      Alert.alert('Copied!', 'Share link copied to clipboard');
    } catch (error) {
      console.error('Failed to create share link:', error);
      Alert.alert('Error', 'Failed to create share link. Please try again.');
    }
  }, [createShareLink]);

  return { shareMusic, copyShareLink };
};
