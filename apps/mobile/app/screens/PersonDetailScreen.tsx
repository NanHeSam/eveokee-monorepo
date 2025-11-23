import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { format } from 'date-fns';

import { useThemeColors } from '../theme/useThemeColors';
import { PersonDetailNavigationProp, PersonDetailRouteProp } from '../navigation/types';
import { api } from '@backend/convex';

export const PersonDetailScreen = () => {
  const colors = useThemeColors();
  const navigation = useNavigation<PersonDetailNavigationProp>();
  const route = useRoute<PersonDetailRouteProp>();

  const { personId } = route.params;

  const personDetail = useQuery(api["memory/people"].getPersonDetail, { personId });

  // Show loading state while query is in progress
  if (personDetail === undefined) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-base" style={{ color: colors.textSecondary }}>
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show not-found state when person doesn't exist
  if (personDetail === null) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="person-outline" size={64} color={colors.textSecondary} style={{ marginBottom: 16 }} />
          <Text className="text-xl font-semibold mb-2" style={{ color: colors.textPrimary }}>
            Person Not Found
          </Text>
          <Text className="text-base text-center mb-6" style={{ color: colors.textSecondary }}>
            This person could not be found or you don&apos;t have permission to view them.
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            className="px-6 py-3 rounded-full"
            style={{ backgroundColor: colors.accentMint }}
          >
            <Text className="text-base font-semibold" style={{ color: colors.background }}>
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { person, recentEvents } = personDetail;
  const personName = person.primaryName;
  const initial = personName.charAt(0).toUpperCase();
  const interactionCount = person.interactionCount || 0;
  const lastMentionedAt = person.lastMentionedAt;

  // Calculate the year for "you've mentioned" text
  const currentYear = new Date().getFullYear();
  const lastMentionedYear = lastMentionedAt ? new Date(lastMentionedAt).getFullYear() : currentYear;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 }}
      >
        {/* Header */}
        <View className="mt-1 mb-6 flex-row items-center justify-between">
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Pressable>
            <Text className="text-base font-semibold" style={{ color: colors.accentMint }}>
              Edit Profile
            </Text>
          </Pressable>
        </View>

        {/* Profile Picture with Initial */}
        <View className="items-center mb-4">
          <View
            className="w-24 h-24 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.accentMint }}
          >
            <Text className="text-4xl font-bold" style={{ color: colors.background }}>
              {initial}
            </Text>
          </View>
          <Text className="text-2xl font-semibold mt-4" style={{ color: colors.textPrimary }}>
            {personName}
          </Text>
          {person.relationshipLabel && (
            <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>
              {person.relationshipLabel}
            </Text>
          )}
        </View>

        {/* You've mentioned section */}
        <View
          className="p-4 rounded-2xl mb-6"
          style={{ backgroundColor: colors.surface }}
        >
          <Text className="text-base" style={{ color: colors.textPrimary }}>
            You&apos;ve mentioned {personName} {interactionCount} {interactionCount === 1 ? 'time' : 'times'} since {lastMentionedYear}.
          </Text>
        </View>

        {/* Recent moments section */}
        {recentEvents && recentEvents.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
              Recent moments
            </Text>
            {recentEvents.map((event) => (
              <Pressable
                key={event._id}
                onPress={() => navigation.navigate('EventDetails', { eventId: event._id })}
                className="mb-4"
              >
                <View
                  className="p-4 rounded-2xl"
                  style={{ backgroundColor: colors.surface }}
                >
                  <Text className="text-base font-semibold mb-1" style={{ color: colors.textPrimary }}>
                    {event.title}
                  </Text>
                  <Text className="text-sm mb-2" style={{ color: colors.textSecondary }}>
                    {format(new Date(event.happenedAt), 'MMM d, yyyy')}
                  </Text>
                  <Text
                    className="text-sm leading-5"
                    style={{ color: colors.textSecondary }}
                    numberOfLines={3}
                  >
                    {event.summary}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {(!recentEvents || recentEvents.length === 0) && (
          <View className="items-center justify-center py-8">
            <Text className="text-base text-center" style={{ color: colors.textSecondary }}>
              No recent moments with {personName} yet.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

