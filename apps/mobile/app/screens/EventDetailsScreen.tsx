import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, PanResponder, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@backend/convex';
import { EventDetailsNavigationProp, EventDetailsRouteProp } from '../navigation/types';
import { Id } from '@backend/convex/convex/_generated/dataModel';
import { useThemeColors } from '../theme/useThemeColors';
import { format } from 'date-fns';

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
    const [people, setPeople] = useState<Array<{ _id: Id<'people'> | string; name: string }>>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isAddingTag, setIsAddingTag] = useState(false);
    const [isAddingPerson, setIsAddingPerson] = useState(false);
    const [newTagText, setNewTagText] = useState('');
    const [newPersonText, setNewPersonText] = useState('');
    const [isEmotionCollapsed, setIsEmotionCollapsed] = useState(true);
    const tagInputRef = React.useRef<TextInput>(null);
    const personInputRef = React.useRef<TextInput>(null);

    useEffect(() => {
        if (event) {
            setTitle(event.title);
            setSummary(event.summary);
            setMood(event.mood);
            setArousal(event.arousal);
            // Extract tag names from tag objects
            setTags(event.tags?.map(tag => tag.name) || []);
            // Store people with IDs for navigation
            setPeople(event.people?.map(person => ({ _id: person._id, name: person.name })) || []);
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
                peopleNames: people.length > 0 ? people.map(p => p.name) : undefined,
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
                        {people.map((person, idx) => {
                            const isTemporary = person._id.toString().startsWith('temp-');
                            const initial = person.name.charAt(0).toUpperCase();
                            
                            return (
                                <Pressable
                                    key={person._id}
                                    onPress={() => {
                                        // Only navigate if this is not a temporary person (has valid ID)
                                        if (!isTemporary) {
                                            navigation.navigate('PersonDetail', { personId: person._id as Id<'people'> });
                                        }
                                    }}
                                    className="flex-row items-center px-3 py-2 rounded-full mr-2 mb-2"
                                    style={{ 
                                        backgroundColor: colors.surface,
                                        opacity: isTemporary ? 0.6 : 1
                                    }}
                                    disabled={isTemporary}
                                >
                                    <View 
                                        className="w-8 h-8 rounded-full mr-2 items-center justify-center"
                                        style={{ backgroundColor: colors.accentMint }}
                                    >
                                        <Text className="text-sm font-semibold" style={{ color: colors.background }}>
                                            {initial}
                                        </Text>
                                    </View>
                                    <Text 
                                        className="text-base mr-2"
                                        style={{ color: colors.textPrimary }}
                                    >
                                        {person.name}
                                    </Text>
                                    <Pressable
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            const newPeople = people.filter((_, i) => i !== idx);
                                            setPeople(newPeople);
                                        }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                                    </Pressable>
                                </Pressable>
                            );
                        })}
                        {isAddingPerson ? (
                            <TextInput
                                ref={personInputRef}
                                className="px-4 py-2 rounded-full mr-2 mb-2 text-base"
                                style={{
                                    backgroundColor: colors.surface,
                                    color: colors.textPrimary,
                                    borderWidth: 1,
                                    borderColor: colors.accentMint,
                                    minWidth: 120,
                                }}
                                placeholder="Person name..."
                                placeholderTextColor={colors.textSecondary}
                                value={newPersonText}
                                onChangeText={setNewPersonText}
                                autoFocus
                                onSubmitEditing={(e) => {
                                    const newPerson = e.nativeEvent.text.trim();
                                    if (newPerson && !people.some(p => p.name === newPerson)) {
                                        // For new people added manually, we'll need to create a person record
                                        // For now, we'll use a temporary ID - this should be handled by the backend
                                        // when saving the event
                                        setPeople([...people, { _id: `temp-${Date.now()}`, name: newPerson }]);
                                    }
                                    setNewPersonText('');
                                    setIsAddingPerson(false);
                                }}
                                onBlur={() => {
                                    const trimmed = newPersonText.trim();
                                    if (trimmed && !people.some(p => p.name === trimmed)) {
                                        // For new people added manually, we'll need to create a person record
                                        // For now, we'll use a temporary ID - this should be handled by the backend
                                        // when saving the event
                                        setPeople([...people, { _id: `temp-${Date.now()}`, name: trimmed }]);
                                    }
                                    setNewPersonText('');
                                    setIsAddingPerson(false);
                                }}
                            />
                        ) : (
                            <Pressable
                                onPress={() => {
                                    setIsAddingPerson(true);
                                    setNewPersonText('');
                                    // Focus the input after a brief delay to ensure it's rendered
                                    setTimeout(() => {
                                        personInputRef.current?.focus();
                                    }, 100);
                                }}
                                className="px-4 py-2 rounded-full mr-2 mb-2"
                                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' }}
                            >
                                <Text style={{ color: colors.textPrimary }}>+ Add person</Text>
                            </Pressable>
                        )}
                    </View>
                </View>

                {/* Tags */}
                <View className="mb-6">
                    <Text className="text-lg font-semibold mb-3" style={{ color: colors.textPrimary }}>
                        Tags
                    </Text>
                    <View className="flex-row flex-wrap">
                        {tags.map((tagName, idx) => (
                            <View
                                key={idx}
                                className="flex-row items-center px-4 py-2 rounded-full mr-2 mb-2"
                                style={{ backgroundColor: colors.surface }}
                            >
                                <Text style={{ color: colors.textPrimary }}>{tagName}</Text>
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
                    <Pressable
                        onPress={() => setIsEmotionCollapsed(!isEmotionCollapsed)}
                        className="flex-row items-center justify-between mb-4"
                    >
                        <Text className="text-lg font-semibold" style={{ color: 'white' }}>
                            Emotion & Intensity
                        </Text>
                        <Ionicons
                            name={isEmotionCollapsed ? 'chevron-down' : 'chevron-up'}
                            size={20}
                            color="white"
                        />
                    </Pressable>

                    {!isEmotionCollapsed && (
                        <>
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
                        </>
                    )}
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
