import { useState } from 'react';
import { View, Image, TouchableOpacity, Modal, Pressable, ScrollView, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@backend/convex';
import { Id } from '@backend/convex/convex/_generated/dataModel';
import { useThemeColors } from '../../theme/useThemeColors';
import Video from 'react-native-video';

type DiaryMediaGridProps = {
  diaryId: Id<'diaries'>;
  editable?: boolean;
};

type MediaItem = {
  _id: Id<'diaryMedia'>;
  url?: string;
  mediaType: 'photo' | 'video';
};

export const DiaryMediaGrid = ({ diaryId, editable = false }: DiaryMediaGridProps) => {
  const colors = useThemeColors();
  const media = useQuery(api.diaryMedia.getDiaryMedia, { diaryId });
  const deleteMedia = useMutation(api.diaryMedia.deleteDiaryMedia);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isViewerVisible, setIsViewerVisible] = useState(false);

  if (!media || media.length === 0) {
    return null;
  }

  const handleDelete = (mediaId: Id<'diaryMedia'>) => {
    Alert.alert(
      'Delete Media',
      'Are you sure you want to delete this photo/video?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMedia({ mediaId });
            } catch (error) {
              Alert.alert('Error', 'Failed to delete media. Please try again.');
            }
          },
        },
      ]
    );
  };

  const openViewer = (item: MediaItem) => {
    setSelectedMedia(item);
    setIsViewerVisible(true);
  };

  const closeViewer = () => {
    setIsViewerVisible(false);
    setSelectedMedia(null);
  };

  // Grid layout: 2 columns
  const gridItems = media.map((item) => (
    <View key={item._id} className="relative mb-2" style={{ width: '48%' }}>
      <TouchableOpacity
        onPress={() => openViewer(item)}
        activeOpacity={0.8}
        className="aspect-square rounded-2xl overflow-hidden"
        style={{ backgroundColor: colors.surface }}
      >
        {item.mediaType === 'photo' && item.url ? (
          <Image source={{ uri: item.url }} className="w-full h-full" resizeMode="cover" />
        ) : item.mediaType === 'video' && item.url ? (
          <View className="w-full h-full">
            <Video
              source={{ uri: item.url }}
              paused
              resizeMode="cover"
              style={styles.thumbnailVideo}
            />
            <View className="absolute inset-0 items-center justify-center">
              <View
                className="h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
              >
                <Ionicons name="play" size={24} color="white" />
              </View>
            </View>
          </View>
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
          </View>
        )}
      </TouchableOpacity>

      {editable && (
        <TouchableOpacity
          onPress={() => handleDelete(item._id)}
          className="absolute top-2 right-2 h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        >
          <Ionicons name="close" size={16} color="white" />
        </TouchableOpacity>
      )}
    </View>
  ));

  return (
    <>
      <View className="flex-row flex-wrap justify-between mt-4">
        {gridItems}
      </View>

      {/* Full-screen media viewer */}
      <Modal
        visible={isViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={closeViewer}
      >
        <View className="flex-1" style={{ backgroundColor: 'rgba(0, 0, 0, 0.95)' }}>
          <Pressable onPress={closeViewer} className="absolute top-12 right-4 z-10">
            <View
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
            >
              <Ionicons name="close" size={24} color="white" />
            </View>
          </Pressable>

          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
            minimumZoomScale={1}
            maximumZoomScale={3}
          >
            {selectedMedia?.mediaType === 'photo' && selectedMedia.url ? (
              <Image
                source={{ uri: selectedMedia.url }}
                className="w-full"
                style={{ aspectRatio: 1 }}
                resizeMode="contain"
              />
            ) : selectedMedia?.mediaType === 'video' && selectedMedia.url ? (
              <Video
                source={{ uri: selectedMedia.url }}
                controls
                resizeMode="contain"
                style={styles.viewerVideo}
              />
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  thumbnailVideo: {
    width: '100%',
    height: '100%',
  },
  viewerVideo: {
    width: '100%',
    aspectRatio: 1,
  },
});
