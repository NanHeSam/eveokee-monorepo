import { useState } from 'react';
import { TouchableOpacity, Text, Alert, ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAction, useMutation } from 'convex/react';
import { api } from '@backend/convex';
import { Id } from '@backend/convex/convex/_generated/dataModel';
import { useThemeColors } from '../../theme/useThemeColors';

type MediaUploadButtonProps = {
  diaryId: Id<'diaries'>;
  onUploadComplete?: () => void;
};

export const MediaUploadButton = ({ diaryId, onUploadComplete }: MediaUploadButtonProps) => {
  const colors = useThemeColors();
  const [isUploading, setIsUploading] = useState(false);
  const generateUploadUrl = useAction(api.diaryMedia.generateUploadUrl);
  const createDiaryMedia = useMutation(api.diaryMedia.createDiaryMedia);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'We need access to your photo library to upload photos and videos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const uploadFile = async (uri: string, mediaType: 'photo' | 'video') => {
    try {
      // Get upload URL
      const uploadUrl = await generateUploadUrl();

      // Fetch the file
      const response = await fetch(uri);
      const blob = await response.blob();

      // Upload to Convex storage
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': blob.type,
        },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Convex returns { storageId } JSON
      const uploadResult: { storageId?: string } = await uploadResponse.json();
      if (!uploadResult.storageId) {
        throw new Error('Upload response missing storageId');
      }

      // Create diaryMedia record
      await createDiaryMedia({
        diaryId,
        storageId: uploadResult.storageId as Id<'_storage'>,
        mediaType,
        contentType: blob.type,
        fileSize: blob.size,
      });

      return true;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const handlePickMedia = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setIsUploading(true);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (result.canceled) {
        setIsUploading(false);
        return;
      }

      // Upload each selected file
      const uploadPromises = result.assets.map((asset) => {
        const mediaType = asset.type === 'video' ? 'video' : 'photo';
        return uploadFile(asset.uri, mediaType);
      });

      await Promise.all(uploadPromises);

      onUploadComplete?.();
    } catch (error) {
      Alert.alert(
        'Upload Failed',
        error instanceof Error ? error.message : 'Failed to upload media. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePickMedia}
      disabled={isUploading}
      className="flex-row items-center justify-center rounded-2xl px-4 py-3"
      style={{
        backgroundColor: colors.surface,
        opacity: isUploading ? 0.6 : 1,
      }}
    >
      {isUploading ? (
        <View className="flex-row items-center">
          <ActivityIndicator size="small" color={colors.accentMint} />
          <Text className="ml-2 text-sm font-medium" style={{ color: colors.textPrimary }}>
            Uploading...
          </Text>
        </View>
      ) : (
        <>
          <Ionicons name="images-outline" size={20} color={colors.accentMint} />
          <Text className="ml-2 text-sm font-medium" style={{ color: colors.textPrimary }}>
            Add Photos/Videos
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

