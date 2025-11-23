import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, PanResponder, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@backend/convex';
import { EventDetailsNavigationProp, EventDetailsRouteProp } from '../navigation/types';
import { useThemeColors } from '../theme/useThemeColors';
import { format } from 'date-fns';
import { Id } from '@backend/convex/convex/_generated/dataModel';

// Emoji mappings for mood (-2 to 2)
const MOOD_EMOJIS: Record<number, string> = {
    [-2]: '😢',
    [-1]: '😔',
    [0]: '😐',
    [1]: '😊',
    [2]: '😄',
};

const MOOD_LABELS: Record<number, string> = {
    [-2]: 'Very Down',
    [-1]: 'Down',
    [0]: 'Neutral',
    [1]: 'Happy',
    [2]: 'Very Happy',
};

// Emoji mappings for arousal (1 to 5)
const AROUSAL_EMOJIS: Record<number, string> = {
    [1]: '😴',
    [2]: '😌',
    [3]: '😊',
    [4]: '😃',
    [5]: '🤩',
};

const AROUSAL_LABELS: Record<number, string> = {
    [1]: 'Very Low',
    [2]: 'Low',
    [3]: 'Moderate',
    [4]: 'High',
    [5]: 'Very High',
};

// Draggable slider component
interface DraggableSliderProps {
    value: number | undefined;
    min: number;
    max: number;
    onValueChange: (value: number) => void;
    emojis: Record<number, string>;
    labels: Record<number, string>;
    label: string;
    colors: ReturnType<typeof useThemeColors>;
}

const DraggableSlider: React.FC<DraggableSliderProps> = ({
    value,
    min,
    max,
    onValueChange,
    emojis,
    labels,
    label,
    colors,
}) => {
    const sliderWidth = Dimensions.get('window').width - 80; // Account for padding
    const [localValue, setLocalValue] = useState<number | undefined>(value);
    const [sliderLayout, setSliderLayout] = useState({ width: sliderWidth, x: 0 });

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    const currentValue = localValue ?? Math.floor((min + max) / 2);
    const valueIndex = currentValue - min;
    const segmentWidth = sliderLayout.width / (max - min);

    const handleTouch = (locationX: number) => {
        const newIndex = Math.round(locationX / segmentWidth);
        const clampedIndex = Math.max(0, Math.min(max - min, newIndex));
        const newValue = min + clampedIndex;
        setLocalValue(newValue);
        onValueChange(newValue);
    };

    const panResponder = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
            const { locationX } = evt.nativeEvent;
            handleTouch(locationX);
        },
        onPanResponderMove: (evt) => {
            const { locationX } = evt.nativeEvent;
            handleTouch(locationX);
        },
        onPanResponderRelease: () => {
            // Value already updated
        },
    });

    return (
        <View className="mb-6">
            <Text className="text-sm mb-3" style={{ color: '#A0A0A0' }}>{label}</Text>
            <View className="flex-row items-center mb-2">
                <Text className="text-3xl mr-3">{emojis[currentValue]}</Text>
                <Text className="text-lg font-semibold text-white">{labels[currentValue]}</Text>
            </View>
            <View
                onLayout={(e) => {
                    const { width, x } = e.nativeEvent.layout;
                    setSliderLayout({ width, x });
                }}
                className="flex-row h-12 rounded-full overflow-hidden"
                style={{ backgroundColor: '#2A3055', width: sliderWidth }}
                {...panResponder.panHandlers}
            >
                {values.map((val, idx) => (
                    <Pressable
                        key={val}
                        onPress={() => {
                            setLocalValue(val);
                            onValueChange(val);
                        }}
                        className="flex-1 items-center justify-center"
                        style={{
                            backgroundColor: idx <= valueIndex ? '#4FD1C7' : 'transparent',
                        }}
                    >
                        <Text className="text-xl">{emojis[val]}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
};

export const EventDetailsScreen = () => {
    const colors = useThemeColors();
    const navigation = useNavigation<EventDetailsNavigationProp>();
    const route = useRoute<EventDetailsRouteProp>();
    const { eventId } = route.params;

    const event = useQuery(api.events.getEvent, { eventId });
    const updateEvent = useMutation(api.events.updateEvent);

    // Local state for form handling
    const [title, setTitle] = useState('');
    const [summary, setSummary] = useState('');
    const [mood, setMood] = useState<number | undefined>(undefined);
    const [arousal, setArousal] = useState<number | undefined>(undefined);
    const [tags, setTags] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isAddingTag, setIsAddingTag] = useState(false);
    const [newTagText, setNewTagText] = useState('');
    const tagInputRef = React.useRef<TextInput>(null);

    useEffect(() => {
        if (event) {
            setTitle(event.title);
            setSummary(event.summary);
            setMood(event.mood);
            setArousal(event.arousal);
            setTags(event.tags || []);
        }
    }, [event]);

    const handleSave = async () => {
        if (isSaving) return;
        
        setIsSaving(true);
        try {
            await updateEvent({
                eventId,
                title,
                summary,
                mood: mood as -2 | -1 | 0 | 1 | 2 | undefined,
                arousal: arousal as 1 | 2 | 3 | 4 | 5 | undefined,
                tags: tags.length > 0 ? tags : undefined,
            });
            Alert.alert('Success', 'Changes saved successfully.');
        } catch (error) {
            console.error('Failed to update event:', error);
            Alert.alert('Error', 'Failed to save changes.');
        } finally {
            setIsSaving(false);
        }
    };

    if (event === undefined) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.accentMint} />
            </SafeAreaView>
        );
    }

    if (event === null) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
                <Text style={{ color: colors.textPrimary }}>Event not found</Text>
                <Pressable onPress={() => navigation.goBack()} className="mt-4 p-2">
                    <Text style={{ color: colors.accentMint }}>Go Back</Text>
                </Pressable>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-2">
                <Pressable onPress={() => navigation.goBack()} className="p-2">
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </Pressable>
                <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                    Derived Memory
                </Text>
                <Pressable
                    onPress={handleSave}
                    disabled={isSaving}
                    className="p-2"
                >
                    {isSaving ? (
                        <ActivityIndicator size="small" color={colors.accentMint} />
                    ) : (
                        <Text className="text-base font-semibold" style={{ color: colors.accentMint }}>
                            Save
                        </Text>
                    )}
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
                {/* Title & Date */}
                <Text className="text-2xl font-bold mb-1" style={{ color: colors.textPrimary }}>
                    {title || 'Untitled Event'}
                </Text>
                <Text className="text-sm mb-6" style={{ color: colors.textSecondary }}>
                    {format(new Date(event.happenedAt), 'MMMM d, yyyy • HH:mm')}
                </Text>

                {/* Editable Short Summary */}
                <View className="mb-6">
                    <Text className="text-sm mb-2" style={{ color: colors.textSecondary }}>
                        Editable Short Summary
                    </Text>
                    <TextInput
                        className="p-4 rounded-2xl text-base"
                        style={{
                            backgroundColor: colors.surface,
                            color: colors.textPrimary,
                            borderWidth: 1,
                            borderColor: colors.border
                        }}
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Enter title..."
                        placeholderTextColor={colors.textSecondary}
                        multiline
                    />
                </View>

                {/* Editable Long Summary */}
                <View className="mb-6">
                    <Text className="text-sm mb-2" style={{ color: colors.textSecondary }}>
                        Editable Long Summary
                    </Text>
                    <TextInput
                        className="p-4 rounded-2xl text-base"
                        style={{
                            backgroundColor: colors.surface,
                            color: colors.textPrimary,
                            borderWidth: 1,
                            borderColor: colors.border,
                            minHeight: 100
                        }}
                        value={summary}
                        onChangeText={setSummary}
                        placeholder="Enter summary..."
                        placeholderTextColor={colors.textSecondary}
                        multiline
                        textAlignVertical="top"
                    />
                </View>

                {/* People */}
                <View className="mb-6">
                    <Text className="text-lg font-semibold mb-3" style={{ color: colors.textPrimary }}>
                        People
                    </Text>
                    <View className="flex-row flex-wrap">
                        {event.peopleDetails?.map((person, idx) => (
                            <View
                                key={idx}
                                className="flex-row items-center px-3 py-2 rounded-full mr-2 mb-2"
                                style={{ backgroundColor: colors.surface }}
                            >
                                {/* Avatar placeholder */}
                                <View className="w-6 h-6 rounded-full bg-gray-400 mr-2 items-center justify-center">
                                    <Text className="text-xs text-white">{person.name.charAt(0)}</Text>
                                </View>
                                <Text style={{ color: colors.textPrimary }}>
                                    {person.name} {person.role ? `(${person.role})` : ''}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Tags */}
                <View className="mb-6">
                    <Text className="text-lg font-semibold mb-3" style={{ color: colors.textPrimary }}>
                        Tags
                    </Text>
                    <View className="flex-row flex-wrap">
                        {tags.map((tag, idx) => (
                            <View
                                key={idx}
                                className="flex-row items-center px-4 py-2 rounded-full mr-2 mb-2"
                                style={{ backgroundColor: colors.surface }}
                            >
                                <Text style={{ color: colors.textPrimary }}>{tag}</Text>
                                <Pressable
                                    onPress={() => {
                                        const newTags = tags.filter((_, i) => i !== idx);
                                        setTags(newTags);
                                    }}
                                    className="ml-2"
                                >
                                    <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                                </Pressable>
                            </View>
                        ))}
                        {isAddingTag ? (
                            <TextInput
                                ref={tagInputRef}
                                className="px-4 py-2 rounded-full mr-2 mb-2 text-base"
                                style={{
                                    backgroundColor: colors.surface,
                                    color: colors.textPrimary,
                                    borderWidth: 1,
                                    borderColor: colors.accentMint,
                                    minWidth: 120,
                                }}
                                placeholder="Tag name..."
                                placeholderTextColor={colors.textSecondary}
                                value={newTagText}
                                onChangeText={setNewTagText}
                                autoFocus
                                onSubmitEditing={(e) => {
                                    const newTag = e.nativeEvent.text.trim();
                                    if (newTag && !tags.includes(newTag)) {
                                        setTags([...tags, newTag]);
                                    }
                                    setNewTagText('');
                                    setIsAddingTag(false);
                                }}
                                onBlur={() => {
                                    const trimmed = newTagText.trim();
                                    if (trimmed && !tags.includes(trimmed)) {
                                        setTags([...tags, trimmed]);
                                    }
                                    setNewTagText('');
                                    setIsAddingTag(false);
                                }}
                            />
                        ) : (
                            <Pressable
                                onPress={() => {
                                    setIsAddingTag(true);
                                    setNewTagText('');
                                    // Focus the input after a brief delay to ensure it's rendered
                                    setTimeout(() => {
                                        tagInputRef.current?.focus();
                                    }, 100);
                                }}
                                className="px-4 py-2 rounded-full mr-2 mb-2"
                                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' }}
                            >
                                <Text style={{ color: colors.textPrimary }}>+ Add tag</Text>
                            </Pressable>
                        )}
                    </View>
                </View>

                {/* Emotion & Intensity */}
                <View className="p-4 rounded-3xl mb-6" style={{ backgroundColor: '#1A1F3D' }}>
                    <Text className="text-lg font-semibold mb-4" style={{ color: 'white' }}>
                        Emotion & Intensity
                    </Text>

                    {/* Mood Slider */}
                    <DraggableSlider
                        value={mood}
                        min={-2}
                        max={2}
                        onValueChange={(val) => setMood(val as -2 | -1 | 0 | 1 | 2)}
                        emojis={MOOD_EMOJIS}
                        labels={MOOD_LABELS}
                        label="Emotion"
                        colors={colors}
                    />

                    {/* Arousal/Intensity Slider */}
                    <DraggableSlider
                        value={arousal}
                        min={1}
                        max={5}
                        onValueChange={(val) => setArousal(val as 1 | 2 | 3 | 4 | 5)}
                        emojis={AROUSAL_EMOJIS}
                        labels={AROUSAL_LABELS}
                        label="Intensity"
                        colors={colors}
                    />
                </View>



                    <Pressable
                        onPress={() => navigation.navigate('DiaryView', { diaryId: event.diaryId })}
                        className="w-full py-3 rounded-xl items-center"
                        style={{ backgroundColor: '#2A3055' }}
                    >
                        <Text className="text-white font-semibold">View Full Entry</Text>
                    </Pressable>

            </ScrollView>
        </SafeAreaView>
    );
};
