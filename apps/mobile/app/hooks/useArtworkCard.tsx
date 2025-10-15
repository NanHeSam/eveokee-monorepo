import { useRef, useCallback } from 'react';
import { Alert, Share } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { useMutation } from 'convex/react';
import { api } from '@diary-vibes/backend';
import { Id } from '@diary-vibes/backend/convex/_generated/dataModel';

interface ArtworkCardData {
  title: string;
  imageUrl?: string;
  lyric?: string;
}

export const useArtworkCard = () => {
  const viewShotRef = useRef<ViewShot>(null);
  const createShareLink = useMutation(api.sharing.createShareLink);

  const generateAndShareCard = useCallback(async (
    musicId: Id<"music">,
    cardData: ArtworkCardData
  ) => {
    try {
      const shareResult = await createShareLink({ musicId });
      
      if (!viewShotRef.current) {
        Alert.alert('Error', 'Unable to generate card. Please try again.');
        return;
      }

      const uri = await viewShotRef.current.capture();
      
      try {
        await Share.share({
          title: `Check out "${cardData.title}" on DiaryVibes`,
          message: `Check out "${cardData.title}" on DiaryVibes!\n\n${shareResult.shareUrl}`,
          url: uri,
        });
      } catch (shareError: any) {
        if (shareError.message !== 'User did not share') {
          console.error('Share error:', shareError);
        }
      }
    } catch (error) {
      console.error('Failed to generate card:', error);
      Alert.alert('Error', 'Failed to generate artwork card. Please try again.');
    }
  }, [createShareLink]);

  return {
    viewShotRef,
    generateAndShareCard,
  };
};
