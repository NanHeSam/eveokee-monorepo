import { Text, TouchableOpacity, View, ScrollView, Alert, TextInput, Switch } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@backend/convex';
import { useThemeColors } from '../theme/useThemeColors';

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Dubai',
  'Australia/Sydney',
];

const CADENCE_OPTIONS = [
  { value: 'daily', label: 'Every Day' },
  { value: 'weekdays', label: 'Weekdays (Mon-Fri)' },
  { value: 'weekends', label: 'Weekends (Sat-Sun)' },
];

export const CallSettingsScreen = () => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  
  const callSettings = useQuery(api.callSettings.getCallSettings);
  const upsertCallSettings = useMutation(api.callSettings.upsertCallSettings);
  const toggleCallSettings = useMutation(api.callSettings.toggleCallSettings);
  const deleteCallSettings = useMutation(api.callSettings.deleteCallSettings);
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [timeOfDay, setTimeOfDay] = useState('09:00');
  const [cadence, setCadence] = useState<'daily' | 'weekdays' | 'weekends'>('daily');
  const [active, setActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    if (callSettings) {
      setPhoneNumber(callSettings.phoneE164);
      setTimezone(callSettings.timezone);
      setTimeOfDay(callSettings.timeOfDay);
      setCadence(callSettings.cadence as 'daily' | 'weekdays' | 'weekends');
      setActive(callSettings.active);
    }
  }, [callSettings]);
  
  const validatePhoneNumber = (phone: string): boolean => {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone);
  };
  
  const validateTimeOfDay = (time: string): boolean => {
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    return timeRegex.test(time);
  };
  
  const handleSave = useCallback(async () => {
    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid phone number in E.164 format (e.g., +12125551234)');
      return;
    }
    
    if (!validateTimeOfDay(timeOfDay)) {
      Alert.alert('Invalid Time', 'Please enter time in HH:MM format (24-hour, e.g., 09:00)');
      return;
    }
    
    setIsSaving(true);
    try {
      await upsertCallSettings({
        phoneE164: phoneNumber,
        timezone,
        timeOfDay,
        cadence,
        active,
      });
      Alert.alert('Success', 'Call settings saved successfully');
    } catch (error) {
      console.error('Failed to save call settings:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save call settings');
    } finally {
      setIsSaving(false);
    }
  }, [phoneNumber, timezone, timeOfDay, cadence, active, upsertCallSettings]);
  
  const handleToggleActive = useCallback(async (value: boolean) => {
    setActive(value);
    if (callSettings) {
      try {
        await toggleCallSettings({ active: value });
      } catch (error) {
        console.error('Failed to toggle call settings:', error);
        setActive(!value);
      }
    }
  }, [callSettings, toggleCallSettings]);
  
  const handleDelete = useCallback(async () => {
    Alert.alert(
      'Delete Call Settings',
      'Are you sure you want to delete your call settings? This will cancel all pending calls.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCallSettings();
              setPhoneNumber('');
              setTimezone('America/New_York');
              setTimeOfDay('09:00');
              setCadence('daily');
              setActive(false);
              Alert.alert('Success', 'Call settings deleted successfully');
            } catch (error) {
              console.error('Failed to delete call settings:', error);
              Alert.alert('Error', 'Failed to delete call settings');
            }
          },
        },
      ]
    );
  }, [deleteCallSettings]);
  
  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background, paddingTop: insets.top }}>
      <ScrollView className="flex-1" style={{ backgroundColor: colors.background }}>
        <View className="p-6">
          <Text className="text-[26px] font-semibold" style={{ color: colors.textPrimary }}>
            Daily Call Settings
          </Text>
          
          <Text className="mt-4 text-base" style={{ color: colors.textSecondary }}>
            Configure your daily call schedule. You&apos;ll receive a call at your specified time based on your cadence.
          </Text>
          
          {/* Active Toggle */}
          <View className="mt-6 flex-row items-center justify-between rounded-3xl p-5" style={{ backgroundColor: colors.surface }}>
            <View className="flex-1">
              <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                Active
              </Text>
              <Text className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                Enable or disable daily calls
              </Text>
            </View>
            <Switch
              value={active}
              onValueChange={handleToggleActive}
              trackColor={{ false: colors.card, true: colors.accentMint }}
              thumbColor={colors.background}
            />
          </View>
          
          {/* Phone Number */}
          <View className="mt-6">
            <Text className="text-base font-semibold mb-2" style={{ color: colors.textPrimary }}>
              Phone Number
            </Text>
            <Text className="text-sm mb-2" style={{ color: colors.textSecondary }}>
              Enter your phone number in E.164 format (e.g., +12125551234)
            </Text>
            <TextInput
              className="rounded-2xl p-4 text-base"
              style={{ backgroundColor: colors.surface, color: colors.textPrimary }}
              placeholder="+12125551234"
              placeholderTextColor={colors.textSecondary}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
          </View>
          
          {/* Timezone */}
          <View className="mt-6">
            <Text className="text-base font-semibold mb-2" style={{ color: colors.textPrimary }}>
              Timezone
            </Text>
            <Text className="text-sm mb-2" style={{ color: colors.textSecondary }}>
              Enter your IANA timezone (e.g., America/New_York)
            </Text>
            <TextInput
              className="rounded-2xl p-4 text-base"
              style={{ backgroundColor: colors.surface, color: colors.textPrimary }}
              placeholder="America/New_York"
              placeholderTextColor={colors.textSecondary}
              value={timezone}
              onChangeText={setTimezone}
              autoCapitalize="none"
            />
          </View>
          
          {/* Time of Day */}
          <View className="mt-6">
            <Text className="text-base font-semibold mb-2" style={{ color: colors.textPrimary }}>
              Time of Day
            </Text>
            <Text className="text-sm mb-2" style={{ color: colors.textSecondary }}>
              Enter time in 24-hour format (HH:MM, e.g., 09:00 for 9 AM)
            </Text>
            <TextInput
              className="rounded-2xl p-4 text-base"
              style={{ backgroundColor: colors.surface, color: colors.textPrimary }}
              placeholder="09:00"
              placeholderTextColor={colors.textSecondary}
              value={timeOfDay}
              onChangeText={setTimeOfDay}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          
          {/* Cadence */}
          <View className="mt-6">
            <Text className="text-base font-semibold mb-2" style={{ color: colors.textPrimary }}>
              Cadence
            </Text>
            <View className="gap-3">
              {CADENCE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  className="flex-row items-center rounded-2xl p-4"
                  style={{ 
                    backgroundColor: cadence === option.value ? colors.accentMint : colors.surface,
                  }}
                  activeOpacity={0.7}
                  onPress={() => setCadence(option.value as 'daily' | 'weekdays' | 'weekends')}
                >
                  <View 
                    className="w-5 h-5 rounded-full border-2 items-center justify-center mr-3"
                    style={{ 
                      borderColor: cadence === option.value ? colors.background : colors.textSecondary,
                    }}
                  >
                    {cadence === option.value && (
                      <View 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: colors.background }}
                      />
                    )}
                  </View>
                  <Text 
                    className="text-base font-medium"
                    style={{ 
                      color: cadence === option.value ? colors.background : colors.textPrimary,
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {/* Save Button */}
          <TouchableOpacity
            className="mt-8 items-center rounded-[26px] py-4"
            style={{ backgroundColor: colors.accentMint, opacity: isSaving ? 0.7 : 1 }}
            activeOpacity={0.85}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text className="text-base font-semibold" style={{ color: colors.background }}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Text>
          </TouchableOpacity>
          
          {/* Delete Button */}
          {callSettings && (
            <TouchableOpacity
              className="mt-4 items-center rounded-[26px] py-4"
              style={{ backgroundColor: colors.accentApricot }}
              activeOpacity={0.85}
              onPress={handleDelete}
            >
              <Text className="text-base font-semibold" style={{ color: colors.background }}>
                Delete Settings
              </Text>
            </TouchableOpacity>
          )}
          
          {/* Consent Notice */}
          <View className="mt-6 rounded-2xl p-4" style={{ backgroundColor: colors.surface }}>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              By enabling daily calls, you consent to receiving automated phone calls at your specified time. 
              Calls may be recorded for quality and training purposes. You can disable calls at any time by 
              toggling the Active switch above.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
