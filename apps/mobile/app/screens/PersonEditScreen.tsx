import React from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useAction } from 'convex/react';

import { useThemeColors } from '../theme/useThemeColors';
import { PersonEditNavigationProp, PersonEditRouteProp } from '../navigation/types';
import { api } from '@backend/convex';

export const PersonEditScreen = () => {
  const colors = useThemeColors();
  const navigation = useNavigation<PersonEditNavigationProp>();
  const route = useRoute<PersonEditRouteProp>();

  const { personId } = route.params;

  const personDetail = useQuery(api["memory/people"].getPersonDetail, { personId });
  const updatePerson = useMutation(api["memory/people"].updatePerson);
  const generateHighlight = useAction(api["memory/people"].generatePersonHighlight);

  const [primaryName, setPrimaryName] = React.useState('');
  const [altNames, setAltNames] = React.useState<string[]>([]);
  const [newAltName, setNewAltName] = React.useState('');
  const [relationshipLabel, setRelationshipLabel] = React.useState('');
  const [highlight, setHighlight] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isAddingAltName, setIsAddingAltName] = React.useState(false);
  const altNameInputRef = React.useRef<TextInput>(null);

  React.useEffect(() => {
    if (personDetail) {
      setPrimaryName(personDetail.person.primaryName);
      setAltNames(personDetail.person.altNames || []);
      setRelationshipLabel(personDetail.person.relationshipLabel || '');
      setHighlight(personDetail.person.highlights?.summary || '');
    }
  }, [personDetail]);

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      const trimmedHighlight = highlight.trim();
      const existingSummary = personDetail?.person.highlights?.summary;
      const existingLastGeneratedAt = personDetail?.person.highlights?.lastGeneratedAt;
      
      // Only update lastGeneratedAt if the highlight text actually changed
      const highlightChanged = trimmedHighlight !== existingSummary;
      const lastGeneratedAt = highlightChanged 
        ? Date.now() 
        : (existingLastGeneratedAt ?? Date.now());
      
      await updatePerson({
        personId,
        primaryName: primaryName.trim() || undefined,
        altNames: altNames.length > 0 ? altNames : undefined,
        relationshipLabel: relationshipLabel.trim() || undefined,
        highlights: trimmedHighlight ? {
          summary: trimmedHighlight,
          lastGeneratedAt,
        } : undefined,
      });
      Alert.alert('Success', 'Person updated successfully.');
      navigation.goBack();
    } catch (error) {
      console.error('Failed to update person:', error);
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateHighlight = async () => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    try {
      const result = await generateHighlight({ personId });
      setHighlight(result.summary);
      Alert.alert('Success', 'Highlight generated successfully.');
    } catch (error) {
      console.error('Failed to generate highlight:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to generate highlight.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddAltName = () => {
    const trimmed = newAltName.trim();
    if (trimmed && !altNames.includes(trimmed) && trimmed !== primaryName) {
      setAltNames([...altNames, trimmed]);
      setNewAltName('');
      setIsAddingAltName(false);
    }
  };

  const handleRemoveAltName = (index: number) => {
    setAltNames(altNames.filter((_, i) => i !== index));
  };

  // Show loading state while query is in progress
  if (personDetail === undefined) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.accentMint} />
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

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable onPress={() => navigation.goBack()} className="p-2">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
          Edit Profile
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
        {/* Primary Name */}
        <View className="mb-6">
          <Text className="text-sm mb-2 font-medium" style={{ color: colors.textSecondary }}>
            Primary Name
          </Text>
          <TextInput
            className="p-4 rounded-2xl text-base"
            style={{
              backgroundColor: colors.surface,
              color: colors.textPrimary,
              borderWidth: 1,
              borderColor: colors.border
            }}
            value={primaryName}
            onChangeText={setPrimaryName}
            placeholder="Enter primary name..."
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Alt Names */}
        <View className="mb-6">
          <Text className="text-sm mb-2 font-medium" style={{ color: colors.textSecondary }}>
            Alternative Names
          </Text>
          <View className="flex-row flex-wrap mb-2">
            {altNames.map((name, idx) => (
              <View
                key={idx}
                className="flex-row items-center px-3 py-2 rounded-full mr-2 mb-2"
                style={{ backgroundColor: colors.surface }}
              >
                <Text style={{ color: colors.textPrimary }}>{name}</Text>
                <Pressable
                  onPress={() => handleRemoveAltName(idx)}
                  className="ml-2"
                >
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            ))}
            {isAddingAltName ? (
              <TextInput
                ref={altNameInputRef}
                className="px-4 py-2 rounded-full mr-2 mb-2 text-base"
                style={{
                  backgroundColor: colors.surface,
                  color: colors.textPrimary,
                  borderWidth: 1,
                  borderColor: colors.accentMint,
                  minWidth: 120,
                }}
                placeholder="Alt name..."
                placeholderTextColor={colors.textSecondary}
                value={newAltName}
                onChangeText={setNewAltName}
                autoFocus
                onSubmitEditing={handleAddAltName}
                onBlur={() => {
                  // Only close the input on blur; don't attempt to add invalid/empty names
                  // User can press Enter to explicitly add a name
                  setNewAltName('');
                  setIsAddingAltName(false);
                }}
              />
            ) : (
              <Pressable
                onPress={() => {
                  setIsAddingAltName(true);
                  setNewAltName('');
                  setTimeout(() => {
                    altNameInputRef.current?.focus();
                  }, 100);
                }}
                className="px-4 py-2 rounded-full mr-2 mb-2"
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' }}
              >
                <Text style={{ color: colors.textPrimary }}>+ Add name</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Relationship Label */}
        <View className="mb-6">
          <Text className="text-sm mb-2 font-medium" style={{ color: colors.textSecondary }}>
            Relationship Label
          </Text>
          <TextInput
            className="p-4 rounded-2xl text-base"
            style={{
              backgroundColor: colors.surface,
              color: colors.textPrimary,
              borderWidth: 1,
              borderColor: colors.border
            }}
            value={relationshipLabel}
            onChangeText={setRelationshipLabel}
            placeholder="e.g., Friend, Colleague, Family..."
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Highlight */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-medium" style={{ color: colors.textSecondary }}>
              Highlight
            </Text>
            <Pressable
              onPress={handleGenerateHighlight}
              disabled={isGenerating}
              className="px-4 py-2 rounded-full"
              style={{ 
                backgroundColor: isGenerating ? colors.card : colors.accentMint,
                opacity: isGenerating ? 0.6 : 1
              }}
            >
              {isGenerating ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color={colors.background} style={{ marginRight: 8 }} />
                  <Text className="text-sm font-semibold" style={{ color: colors.background }}>
                    Generating...
                  </Text>
                </View>
              ) : (
                <Text className="text-sm font-semibold" style={{ color: colors.background }}>
                  Generate
                </Text>
              )}
            </Pressable>
          </View>
          <TextInput
            className="p-4 rounded-2xl text-base"
            style={{
              backgroundColor: colors.surface,
              color: colors.textPrimary,
              borderWidth: 1,
              borderColor: colors.border,
              minHeight: 120
            }}
            value={highlight}
            onChangeText={setHighlight}
            placeholder="Click Generate to create a highlight based on recent events..."
            placeholderTextColor={colors.textSecondary}
            multiline
            textAlignVertical="top"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

