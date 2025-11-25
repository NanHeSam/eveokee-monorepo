import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, PanResponder, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@backend/convex';
import { EventDetailsNavigationProp, EventDetailsRouteProp } from '../navigation/types';
import { Id } from '@backend/convex/convex/_generated/dataModel';
import { useThemeColors } from '../theme/useThemeColors';
import { format } from 'date-fns';
import { useUser } from '@clerk/clerk-expo';

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

// Valid mood values: -2, -1, 0, 1, 2
const VALID_MOOD_VALUES = [-2, -1, 0, 1, 2] as const;
const VALID_MOOD_SET = new Set(VALID_MOOD_VALUES);
type ValidMoodValue = typeof VALID_MOOD_VALUES[number];

// Valid arousal values: 1, 2, 3, 4, 5
const VALID_AROUSAL_VALUES = [1, 2, 3, 4, 5] as const;
const VALID_AROUSAL_SET = new Set(VALID_AROUSAL_VALUES);
type ValidArousalValue = typeof VALID_AROUSAL_VALUES[number];

/**
 * Validates and normalizes mood value to ensure it matches backend expectations.
 * Returns undefined if the value is invalid, preventing runtime errors.
 */
function validateMood(value: number | undefined): -2 | -1 | 0 | 1 | 2 | undefined {
    if (value === undefined) return undefined;
    if (VALID_MOOD_SET.has(value as ValidMoodValue)) {
        return value as -2 | -1 | 0 | 1 | 2;
    }
    console.warn(`Invalid mood value: ${value}. Expected one of: ${VALID_MOOD_VALUES.join(', ')}`);
    return undefined;
}

/**
 * Validates and normalizes arousal value to ensure it matches backend expectations.
 * Returns undefined if the value is invalid, preventing runtime errors.
 */
function validateArousal(value: number | undefined): 1 | 2 | 3 | 4 | 5 | undefined {
    if (value === undefined) return undefined;
    if (VALID_AROUSAL_SET.has(value as ValidArousalValue)) {
        return value as 1 | 2 | 3 | 4 | 5;
    }
    console.warn(`Invalid arousal value: ${value}. Expected one of: ${VALID_AROUSAL_VALUES.join(', ')}`);
    return undefined;
}

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
    const scaleAnim = React.useRef(new Animated.Value(1)).current;
    const isDraggingRef = React.useRef(false);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    const currentValue = localValue ?? Math.floor((min + max) / 2);
    const valueIndex = currentValue - min;

    const clamp = (val: number, minVal: number, maxVal: number) => {
        return Math.min(Math.max(val, minVal), maxVal);
    };

    const handleTouch = React.useCallback((locationX: number) => {
        if (sliderLayout.width <= 0) return;
        
        const segmentCount = max - min;
        const clampedX = clamp(locationX, 0, sliderLayout.width);
        const segmentWidth = sliderLayout.width / segmentCount;
        const newIndex = Math.round(clampedX / segmentWidth);
        const clampedIndex = clamp(newIndex, 0, segmentCount);
        const newValue = min + clampedIndex;
        
        setLocalValue((prevValue) => {
            if (newValue !== prevValue) {
                onValueChange(newValue);
                
                // Gentle animation on change
                Animated.sequence([
                    Animated.timing(scaleAnim, {
                        toValue: 1.05,
                        duration: 100,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scaleAnim, {
                        toValue: 1,
                        duration: 150,
                        useNativeDriver: true,
                    }),
                ]).start();
                
                return newValue;
            }
            return prevValue;
        });
    }, [sliderLayout.width, min, max, onValueChange, scaleAnim]);

    const panResponder = React.useMemo(() => {
        return PanResponder.create({
            // Capture the gesture immediately to prevent ScrollView from intercepting
            onStartShouldSetPanResponderCapture: () => true,
            onStartShouldSetPanResponder: () => true,
            // Prioritize horizontal movement - if horizontal movement is greater than or equal to vertical, capture it
            // This prevents ScrollView from scrolling when user drags horizontally with slight vertical movement
            onMoveShouldSetPanResponderCapture: (_, gestureState) => {
                // If horizontal movement is dominant or significant, capture to prevent ScrollView scrolling
                const absDx = Math.abs(gestureState.dx);
                const absDy = Math.abs(gestureState.dy);
                return absDx >= absDy && absDx > 5;
            },
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Once we've started, respond to any horizontal movement
                return isDraggingRef.current || Math.abs(gestureState.dx) > 5;
            },
            onPanResponderGrant: (evt) => {
                isDraggingRef.current = true;
                const { locationX } = evt.nativeEvent;
                handleTouch(locationX);
            },
            onPanResponderMove: (evt) => {
                if (!isDraggingRef.current) return;
                const { locationX } = evt.nativeEvent;
                handleTouch(locationX);
            },
            onPanResponderRelease: () => {
                isDraggingRef.current = false;
            },
            onPanResponderTerminate: () => {
                isDraggingRef.current = false;
            },
            // Prevent ScrollView from terminating our gesture when dragging
            onPanResponderTerminationRequest: () => {
                // Return false to prevent termination while actively dragging
                // This keeps the gesture locked to the slider even if ScrollView tries to take over
                return false;
            },
        });
    }, [handleTouch]);

    return (
        <View className="mb-6">
            <Text className="text-sm mb-3" style={{ color: colors.textSecondary }}>{label}</Text>
            <Animated.View 
                className="flex-row items-center mb-2"
                style={{ transform: [{ scale: scaleAnim }] }}
            >
                <Text className="text-3xl mr-3">{emojis[currentValue]}</Text>
                <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>{labels[currentValue]}</Text>
            </Animated.View>
            <View
                onLayout={(e) => {
                    const { width, x } = e.nativeEvent.layout;
                    setSliderLayout({ width, x });
                }}
                className="flex-row h-12 rounded-full overflow-hidden"
                style={{ backgroundColor: colors.border, width: sliderWidth }}
                {...panResponder.panHandlers}
            >
                {values.map((val, idx) => (
                    <View
                        key={val}
                        className="flex-1 items-center justify-center"
                        style={{
                            backgroundColor: idx <= valueIndex ? colors.accentMint : 'transparent',
                        }}
                        pointerEvents="none"
                    >
                        <Text className="text-xl">{emojis[val]}</Text>
                    </View>
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
    const { user } = useUser();

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
    const tagInputRef = React.useRef<TextInput>(null);
    const personInputRef = React.useRef<TextInput>(null);
    const personAnimations = React.useRef<Map<string, Animated.Value>>(new Map()).current;
    const didAddPersonRef = React.useRef<boolean>(false);

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
                mood: validateMood(mood),
                arousal: validateArousal(arousal),
                tags: tags.length > 0 ? tags : undefined,
                peopleNames: people.length > 0 ? people.map(p => p.name) : undefined,
            });
            // Reset the add-person flag after successful save
            didAddPersonRef.current = false;
            Alert.alert('Success', 'Changes saved successfully.');
        } catch (error) {
            console.error('Failed to update event:', error);
            Alert.alert('Error', 'Failed to save changes.');
        } finally {
            setIsSaving(false);
        }
    };

    const addPersonFromText = (text: string) => {
        // Guard against duplicate adds from both onSubmitEditing and onBlur
        if (didAddPersonRef.current) {
            return;
        }

        const trimmed = text.trim();
        if (trimmed && !people.some(p => p.name === trimmed)) {
            // Mark that we're adding to prevent duplicate adds
            didAddPersonRef.current = true;
            
            // For new people added manually, we'll need to create a person record
            // For now, we'll use a temporary ID - this should be handled by the backend
            // when saving the event
            setPeople([...people, { _id: `temp-${Date.now()}`, name: trimmed }]);
        }
        
        // Always clear the input and close the add-person UI
        setNewPersonText('');
        setIsAddingPerson(false);
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
                    What stayed with me
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
                <Text className="text-sm mb-4" style={{ color: colors.textSecondary }}>
                    {format(new Date(event.happenedAt), 'MMMM d, yyyy • HH:mm')}
                </Text>

                {/* Memory Identity Layer */}
                <View className="mb-6 pb-4 border-b" style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }}>
                    <Text className="text-xs italic" style={{ color: colors.textSecondary }}>
                        A fragment of your life, preserved in sound
                    </Text>
                </View>

                {/* Emotion & Intensity - Moved to top */}
                <View className="p-4 rounded-3xl mb-6" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <Text className="text-base mb-4 italic" style={{ color: colors.textSecondary }}>
                        This moment left me feeling…
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

                {/* Narrative - Long Summary */}
                <View className="mb-6">
                    <Text className="text-sm mb-2 italic" style={{ color: colors.textSecondary }}>
                        The story of this moment
                    </Text>
                    <TextInput
                        className="p-4 rounded-2xl text-base"
                        style={{
                            backgroundColor: colors.surface,
                            color: colors.textPrimary,
                            borderWidth: 1,
                            borderColor: colors.border,
                            minHeight: 120
                        }}
                        value={summary}
                        onChangeText={setSummary}
                        placeholder="What happened? What did it mean to you?"
                        placeholderTextColor={colors.textSecondary}
                        multiline
                        textAlignVertical="top"
                    />
                </View>

                {/* Editable Short Summary */}
                <View className="mb-6">
                    <Text className="text-sm mb-2 italic" style={{ color: colors.textSecondary }}>
                        A brief memory
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
                        placeholder="A few words to remember this by..."
                        placeholderTextColor={colors.textSecondary}
                        multiline
                    />
                </View>

                {/* People - Who was part of this moment */}
                <View className="mb-6">
                    <Text className="text-lg font-semibold mb-3" style={{ color: colors.textPrimary }}>
                        Who was part of this moment
                    </Text>
                    <View className="flex-row flex-wrap">
                        {people.map((person, idx) => {
                            const isTemporary = person._id.toString().startsWith('temp-');
                            const initial = person.name.charAt(0).toUpperCase();
                            
                            // Get or create animation for this person
                            if (!personAnimations.has(person._id.toString())) {
                                personAnimations.set(person._id.toString(), new Animated.Value(1));
                            }
                            const scaleAnim = personAnimations.get(person._id.toString())!;
                            
                            return (
                                <Animated.View
                                    key={person._id}
                                    style={{ transform: [{ scale: scaleAnim }] }}
                                >
                                    <Pressable
                                        onPress={() => {
                                            // Gentle pulse animation
                                            Animated.sequence([
                                                Animated.timing(scaleAnim, {
                                                    toValue: 1.1,
                                                    duration: 100,
                                                    useNativeDriver: true,
                                                }),
                                                Animated.timing(scaleAnim, {
                                                    toValue: 1,
                                                    duration: 200,
                                                    useNativeDriver: true,
                                                }),
                                            ]).start();
                                            
                                            // Only navigate if this is not a temporary person (has valid ID)
                                            if (!isTemporary) {
                                                navigation.navigate('PersonDetail', { personId: person._id as Id<'people'> });
                                            }
                                        }}
                                        className="flex-row items-center px-3 py-2 rounded-full mr-2 mb-2"
                                        style={{ 
                                            backgroundColor: colors.surface,
                                            borderWidth: 1,
                                            borderColor: colors.accentMint + '30', // 30 = ~19% opacity in hex
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
                                </Animated.View>
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
                                    addPersonFromText(e.nativeEvent.text);
                                }}
                                onBlur={() => {
                                    addPersonFromText(newPersonText);
                                }}
                            />
                        ) : (
                            <Pressable
                                onPress={() => {
                                    // Reset the flag when opening the input for a new person
                                    didAddPersonRef.current = false;
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

                {/* Themes - What this moment was about */}
                <View className="mb-6">
                    <Text className="text-lg font-semibold mb-3" style={{ color: colors.textPrimary }}>
                        Themes of this moment
                    </Text>
                    <View className="flex-row flex-wrap">
                        {tags.map((tagName, idx) => (
                            <View
                                key={idx}
                                className="flex-row items-center px-4 py-2 rounded-full mr-2 mb-2"
                                style={{ 
                                    backgroundColor: colors.surface,
                                    // Soft gradient effect using opacity
                                    borderWidth: 1,
                                    borderColor: colors.accentMint + '30', // 30 = ~19% opacity in hex
                                }}
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
                                placeholder="e.g., 'A moment of alignment' or 'Curious connection'..."
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
                                <Text style={{ color: colors.textPrimary }}>+ Add theme</Text>
                            </Pressable>
                        )}
                    </View>
                </View>



                    <Pressable
                        onPress={() => navigation.navigate('DiaryView', { diaryId: event.diaryId })}
                        className="w-full py-3 rounded-xl items-center"
                        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                    >
                        <Text className="font-semibold" style={{ color: colors.textPrimary }}>View Full Entry</Text>
                    </Pressable>

            </ScrollView>
        </SafeAreaView>
    );
};
