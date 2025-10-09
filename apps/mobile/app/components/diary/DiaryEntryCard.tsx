import { Text, View, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';

import { useThemeColors } from '../../theme/useThemeColors';

export type DiaryEntryCardProps = {
  title: string;
  content: string;
  dateLabel?: string;
  dayNumberLabel?: string;
  isLastInGroup?: boolean;
  hasMusic?: boolean;
  showDate?: boolean;
  time?: string;
  onDelete?: () => void;
  enableSwipeToDelete?: boolean;
  compact?: boolean;
};

export const DiaryEntryCard = ({ 
  title, 
  content, 
  dateLabel, 
  dayNumberLabel, 
  isLastInGroup, 
  hasMusic, 
  showDate, 
  time, 
  onDelete,
  enableSwipeToDelete = false,
  compact = false
}: DiaryEntryCardProps) => {
  const colors = useThemeColors();

  const cardContent = (
    <View className="flex-row items-center py-2" style={{ backgroundColor: colors.card }}>
      {showDate && (dateLabel || dayNumberLabel) ? (
        <View className="w-16 items-center">
          {dateLabel ? (
            <Text className="mb-1 text-xs tracking-[1px] text-center" style={{ color: colors.textSecondary }}>
              {dateLabel}
            </Text>
          ) : null}
          {dayNumberLabel ? (
            <Text className="text-[26px] font-bold text-center" style={{ color: colors.textPrimary }}>
              {dayNumberLabel}
            </Text>
          ) : null}
        </View>
      ) : compact ? null : (
        <View className="w-16" />
      )}

      <View className="flex-1 px-6">
        <Text numberOfLines={3} ellipsizeMode="tail" className="text-sm" style={{ color: colors.textSecondary }}>
          {content}
        </Text>
        {time && (
          <Text className="mt-1 text-xs" style={{ color: colors.textSecondary }}>
            {time}
          </Text>
        )}
      </View>

      {hasMusic && (
        <View className="h-8 w-8 items-center justify-center rounded-full mr-4" style={{ backgroundColor: colors.surface }}>
          <Ionicons name="musical-notes" size={16} color={colors.textSecondary} />
        </View>
      )}
    </View>
  );

  const renderRightActions = (progress: Animated.AnimatedAddition<number>, dragX: Animated.AnimatedAddition<number>) => {
    const opacity = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <View className="w-20 items-center justify-center" style={{ backgroundColor: '#FF3B30' }}>
        <Animated.View style={{ opacity }}>
          <Pressable
            onPress={onDelete}
            className="h-full w-full items-center justify-center"
          >
            <Ionicons name="trash" size={20} color="white" />
          </Pressable>
        </Animated.View>
      </View>
    );
  };

  if (!enableSwipeToDelete || !onDelete) {
    return (
      <View>
        {cardContent}
        {/* Line separator for non-last entries in the same group */}
        {!isLastInGroup && (
          <View className="mx-5 h-px" style={{ backgroundColor: colors.border }} />
        )}
      </View>
    );
  }

  return (
    <View>
      <Swipeable renderRightActions={renderRightActions}>
        {cardContent}
      </Swipeable>
      
      {/* Line separator for non-last entries in the same group */}
      {!isLastInGroup && (
        <View className="mx-5 h-px" style={{ backgroundColor: colors.border }} />
      )}
    </View>
  );
};


