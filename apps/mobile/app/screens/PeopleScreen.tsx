import { View, Text, ScrollView, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '@backend/convex';
import { useThemeColors } from '../theme/useThemeColors';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SettingsStackParamList } from '../navigation/types';

type PeopleScreenNavigationProp = NativeStackNavigationProp<SettingsStackParamList>;

type Person = NonNullable<typeof api["memory/people"]["listPeople"]["_returnType"]>[number];

export const PeopleScreen = () => {
  const colors = useThemeColors();
  const navigation = useNavigation<PeopleScreenNavigationProp>();
  
  const people = useQuery(api["memory/people"].listPeople);

  const renderPerson = ({ item }: { item: Person }) => {
    const primaryName = item.primaryName || 'Unknown';
    const initial = primaryName && primaryName.length > 0 
      ? primaryName.charAt(0).toUpperCase() 
      : '?';
    
    return (
      <Pressable
        onPress={() => navigation.navigate('PersonDetail', { personId: item._id })}
        className="flex-row items-center p-4 mb-3 rounded-2xl"
        style={{ backgroundColor: colors.surface }}
      >
        <View
          className="w-12 h-12 rounded-full items-center justify-center mr-4"
          style={{ backgroundColor: colors.accentMint }}
        >
          <Text className="text-xl font-bold" style={{ color: colors.background }}>
            {initial}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
            {primaryName}
          </Text>
          {item.relationshipLabel && (
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {item.relationshipLabel}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-1 px-5">
        <View className="mt-2 mb-6 flex-row items-center">
          <Pressable onPress={() => navigation.goBack()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
            People
          </Text>
        </View>

        {people === undefined ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-base" style={{ color: colors.textSecondary }}>
              Loading...
            </Text>
          </View>
        ) : people.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-base text-center" style={{ color: colors.textSecondary }}>
              No people found.
            </Text>
          </View>
        ) : (
          <FlatList
            data={people}
            renderItem={renderPerson}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

