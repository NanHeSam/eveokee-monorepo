import { memo, useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';

import { useThemeColors } from '../../theme/useThemeColors';

type MarkedDates = Record<string, { selected?: boolean; marked?: boolean; dotColor?: string; selectedColor?: string; selectedTextColor?: string }>;

type DiaryCalendarProps = {
  selectedDate: string;
  currentMonth: string;
  datesWithEntries: string[];
  onSelectDate: (isoDate: string) => void;
  onChangeMonth: (isoMonth: string) => void;
};

const buildMarkedDates = (dates: string[], selectedDate: string, colors: ReturnType<typeof useThemeColors>): MarkedDates => {
  const uniqueDates = Array.from(new Set(dates));
 
  const marked = uniqueDates.reduce<MarkedDates>((acc, date) => {
    acc[date] = {
      ...(acc[date] ?? {}),
      marked: true,
      dotColor: colors.accentMint,
    };
    return acc;
  }, {});

  if (selectedDate) {
    const existing = marked[selectedDate] ?? {};
    const hasEntry = uniqueDates.includes(selectedDate);

    if (hasEntry) {
      marked[selectedDate] = {
        ...existing,
        selected: true,
        selectedColor: colors.accentMint,
        selectedTextColor: colors.background,
      };
    } else {
      const { marked: _marked, dotColor: _dotColor, ...rest } = existing;
      marked[selectedDate] = {
        ...rest,
        selected: true,
        selectedColor: colors.accentMint,
        selectedTextColor: colors.background,
      };
    }
  }

  return marked;
};

const DiaryCalendarComponent = ({ selectedDate, currentMonth, datesWithEntries, onSelectDate, onChangeMonth }: DiaryCalendarProps) => {
  const colors = useThemeColors();
  const markedDates = useMemo(
    () => buildMarkedDates(datesWithEntries, selectedDate, colors),
    [colors, datesWithEntries, selectedDate],
  );

  const handleDayPress = useCallback(
    (day: DateData) => {
      onSelectDate(day.dateString);
    },
    [onSelectDate],
  );

  const handleMonthChange = useCallback(
    (month: any) => {
      const isoMonth = `${month.year}-${String(month.month).padStart(2, '0')}-01`;
      onChangeMonth(isoMonth);
    },
    [onChangeMonth],
  );

  return (
    <View
      className="rounded-[28px] px-4 pt-5 pb-1 shadow-lg"
      style={{
        backgroundColor: colors.surface,
        shadowColor: colors.scheme === 'dark' ? '#000' : '#8F99A6',
        shadowOpacity: 0.06,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 2,
      }}
    >
      <Calendar
        current={currentMonth}
        markingType="dot"
        theme={buildCalendarTheme(colors)}
        markedDates={markedDates}
        onDayPress={handleDayPress}
        onMonthChange={handleMonthChange}
        hideExtraDays
      />
    </View>
  );
};

export const DiaryCalendar = memo(DiaryCalendarComponent);

const buildCalendarTheme = (colors: ReturnType<typeof useThemeColors>) => ({
  backgroundColor: 'transparent',
  calendarBackground: 'transparent',
  textSectionTitleColor: colors.textSecondary,
  textDisabledColor: colors.textMuted,
  monthTextColor: colors.textPrimary,
  todayTextColor: colors.accentApricot,
  dayTextColor: colors.textPrimary,
  textDayFontColor: colors.textPrimary,
  selectedDayBackgroundColor: colors.accentMint,
  selectedDayTextColor: colors.background,
  textDayFontFamily: 'System',
  textMonthFontFamily: 'System',
  textDayHeaderFontFamily: 'System'
});
