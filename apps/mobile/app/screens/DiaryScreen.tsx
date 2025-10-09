import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { Text, TouchableOpacity, View, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTrackPlayerStore } from '../store/useTrackPlayerStore';

import { DiaryCalendar } from '../components/diary/DiaryCalendar';
import { useThemeColors } from '../theme/useThemeColors';
import { DiaryEntryCard } from '../components/diary/DiaryEntryCard';
import { DiaryStackNavigationProp } from '../navigation/types';
import { api, Id } from 'convex-backend';
import { format } from "date-fns";

type DiaryEntry = {
  id: Id<'diaries'>;
  date: string;
  title: string;
  content: string;
  image?: string;
  hasMusic?: boolean;
  time: string;
};

type DiaryDoc = NonNullable<typeof api.diaries.listDiaries._returnType>[number];

const mapDiaryDocsToEntries = (docs: DiaryDoc[]): DiaryEntry[] =>
  docs.map(doc => ({
    id: doc._id,
    date: format(new Date(doc.date), "yyyy-MM-dd"),
    title: doc.title ?? 'Untitled Entry',
    content: doc.content,
    hasMusic: !!doc.primaryMusic,
    time: format(new Date(doc.date), "HH:mm")
  }));

type ViewMode = 'list' | 'calendar';


const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const parseLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
};

const buildDateGroups = (entries: DiaryEntry[]) => {
  const grouped = new Map<string, DiaryEntry[]>();

  entries
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .forEach(entry => {
      const bucket = grouped.get(entry.date) ?? [];
      bucket.push(entry);
      grouped.set(entry.date, bucket);
    });

  return Array.from(grouped.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, data]) => {
      const parsedDate = parseLocalDate(date);
      const monthKey = date.slice(0, 7);
      const [year, month] = monthKey.split('-').map(Number);
      const monthLabel = `${MONTH_NAMES[(month ?? 1) - 1]} ${year}`.toUpperCase();
      return { 
        date, 
        data, 
        monthLabel,
        dayLabel: parsedDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        dayNumber: String(parsedDate.getDate())
      };
    });
};

const createEntriesMap = (entries: DiaryEntry[]) => {
  const map = new Map<string, DiaryEntry[]>();
  entries.forEach(entry => {
    const list = map.get(entry.date) ?? [];
    list.push(entry);
    map.set(entry.date, list);
  });
  return map;
};

const formatFriendlyDate = (dateString: string) => {
  const date = parseLocalDate(dateString);
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

export const DiaryScreen = () => {
  const diaryDocs = useQuery(api.diaries.listDiaries);
  const deleteDiary = useMutation(api.diaries.deleteDiary);
  const entries = useMemo(() => (diaryDocs ? mapDiaryDocsToEntries(diaryDocs) : []), [diaryDocs]);
  const dateGroups = useMemo(() => buildDateGroups(entries), [entries]);
  const entriesByDate = useMemo(() => createEntriesMap(entries), [entries]);
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DiaryStackNavigationProp>();
  const { isVisible: isMiniPlayerVisible } = useTrackPlayerStore();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [currentMonth, setCurrentMonth] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const hasInitializedSelection = useRef(false);

  const datesWithEntries = useMemo(() => Array.from(entriesByDate.keys()), [entriesByDate]);
  const selectedEntries = entriesByDate.get(selectedDate) ?? [];

  const isLoading = diaryDocs === undefined;

  const handleDeleteDiary = async (diaryId: Id<'diaries'>) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this diary entry? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDiary({ diaryId });
            } catch (error) {
              console.error('Failed to delete diary:', error);
              Alert.alert('Error', 'Failed to delete diary entry. Please try again.');
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (hasInitializedSelection.current || isLoading || entries.length === 0) {
      return;
    }

    const latest = entries.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    if (latest) {
      hasInitializedSelection.current = true;
      setSelectedDate(latest.date);
      setCurrentMonth(latest.date);
    }
  }, [entries, isLoading]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-1 px-5 pt-2" style={{ backgroundColor: colors.background }}>
        <View className="pt-2 pb-3 items-center">
          <Text className="text-[24px] font-semibold text-center" style={{ color: colors.textPrimary }}>
            Your Diaries
          </Text>
          <Text className="mt-1 text-sm text-center" style={{ color: colors.textSecondary }}>
            A creative studio where words become melodies.
          </Text>
        </View>

        <View className="mt-1 mb-2 flex-row rounded-3xl p-1" style={{ backgroundColor: colors.surface }}>
          <ToggleButton label="List" isActive={viewMode === 'list'} onPress={() => setViewMode('list')} colors={colors} />
          <ToggleButton label="Calendar" isActive={viewMode === 'calendar'} onPress={() => setViewMode('calendar')} colors={colors} />
        </View>

        {viewMode === 'list' ? (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 160 }}
            showsVerticalScrollIndicator={false}
          >
            {isLoading ? (
              <View className="mt-12 items-center justify-center">
                <Text className="text-base text-center" style={{ color: colors.textSecondary }}>
                  Loading your diary entries…
                </Text>
              </View>
            ) : dateGroups.length > 0 ? (
              dateGroups.map((group, groupIndex) => (
                <View key={group.date}>
                  {/* Month header - only show if it's the first group or month changed */}
                  {groupIndex === 0 || dateGroups[groupIndex - 1].monthLabel !== group.monthLabel ? (
                    <Text className="mt-2 mb-1 font-semibold tracking-[1.2px]" style={{ color: colors.textSecondary }}>
                      {group.monthLabel}
                    </Text>
                  ) : null}
                  
                  {/* Date group - single bubble for all entries of the same day */}
                  <View className="mb-1 rounded-3xl p-3" style={{ backgroundColor: colors.card, shadowColor: colors.scheme === 'dark' ? '#000' : '#8F99A6', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 }}>
                    {/* Entries for this date */}
                    {group.data.map((entry, entryIndex) => (
                      <Pressable
                        key={entry.id}
                        onPress={() =>
                          navigation.navigate('DiaryEdit', {
                            diaryId: entry.id,
                            content: entry.content,
                            title: entry.title
                          })
                        }
                      >
                        <DiaryEntryCard
                          title={entry.title}
                          content={entry.content}
                          dateLabel={group.dayLabel}
                          dayNumberLabel={group.dayNumber}
                          hasMusic={entry.hasMusic}
                          isLastInGroup={entryIndex === group.data.length - 1}
                          showDate={entryIndex === 0}
                          time={entry.time}
                          onDelete={() => handleDeleteDiary(entry.id)}
                          enableSwipeToDelete={true}
                        />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))
            ) : (
              <View className="mt-12 items-center justify-center">
                <Text className="text-base text-center" style={{ color: colors.textSecondary }}>
                  No entries yet. Start by adding your first memory!
                </Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 160 }}
            showsVerticalScrollIndicator={false}
          >
            <DiaryCalendar
              selectedDate={selectedDate}
              currentMonth={currentMonth}
              datesWithEntries={datesWithEntries}
              onSelectDate={isoDate => {
                hasInitializedSelection.current = true;
                setSelectedDate(isoDate);
                setCurrentMonth(`${isoDate.slice(0, 7)}-01`);
              }}
              onChangeMonth={isoMonth => {
                setCurrentMonth(isoMonth);
              }}
            />

            <View className="-mt-2 rounded-[28px] p-5" style={{ backgroundColor: colors.surface }}>
              <Text className="mb-3 text-lg font-semibold" style={{ color: colors.textPrimary }}>
                Entries on {formatFriendlyDate(selectedDate)}
              </Text>
              {isLoading ? (
                <Text className="text-sm" style={{ color: colors.textSecondary }}>
                  Loading your diary entries…
                </Text>
              ) : selectedEntries.length > 0 ? (
                selectedEntries.map((entry, index) => (
                  <Pressable
                    key={entry.id}
                    onPress={() =>
                      navigation.navigate('DiaryEdit', {
                        diaryId: entry.id,
                        content: entry.content,
                        title: entry.title
                      })
                    }
                  >
                    <DiaryEntryCard 
                      title={entry.title} 
                      content={entry.content} 
                      hasMusic={entry.hasMusic} 
                      time={entry.time}
                      isLastInGroup={index === selectedEntries.length - 1}
                      onDelete={() => handleDeleteDiary(entry.id)}
                      enableSwipeToDelete={true}
                      compact={true}
                    />
                  </Pressable>
                ))
              ) : (
                <Text className="text-sm" style={{ color: colors.textSecondary }}>
                  No memories recorded for this day yet.
                </Text>
              )}
            </View>
          </ScrollView>
        )}
      </View>
      <Pressable
        onPress={() => navigation.navigate('DiaryEdit')}
        className="absolute right-6 h-16 w-16 items-center justify-center rounded-full"
        style={{
          bottom: isMiniPlayerVisible ? 100 : 20, // Move up when mini player is visible, but keep it lower
          backgroundColor: colors.accentMint,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6
        }}
      >
        <Ionicons name="add" size={36} color={colors.background} />
      </Pressable>
    </SafeAreaView>
  );
};

const ToggleButton = ({
  label,
  isActive,
  onPress,
  colors
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useThemeColors>;
}) => (
  <TouchableOpacity
    className={`flex-1 items-center justify-center rounded-[20px] py-2.5 ${isActive ? '' : ''}`}
    style={{ backgroundColor: isActive ? colors.card : 'transparent' }}
    activeOpacity={0.85}
    onPress={onPress}
  >
    <Text
      className="text-sm font-semibold text-center"
      style={{ color: isActive ? colors.textPrimary : colors.textSecondary }}
    >
      {label}
    </Text>
  </TouchableOpacity>
);


