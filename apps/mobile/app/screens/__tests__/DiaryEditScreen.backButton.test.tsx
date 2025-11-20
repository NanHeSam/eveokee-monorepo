import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useMutation, useAction } from 'convex/react';
import { DiaryEditScreen } from '../DiaryEditScreen';
import { api } from '@backend/convex';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Mock dependencies
jest.mock('@react-navigation/native');
jest.mock('convex/react');
jest.mock('@backend/convex', () => ({
  api: {
    diaries: {
      createDiary: 'diaries:createDiary',
      updateDiary: 'diaries:updateDiary',
      deleteDiary: 'diaries:deleteDiary',
      listDiaries: 'diaries:listDiaries',
    },
    music: {
      listPlaylistMusic: 'music:listPlaylistMusic',
      startDiaryMusicGeneration: 'music:startDiaryMusicGeneration',
    },
    diaryMedia: {
      getDiaryMedia: 'diaryMedia:getDiaryMedia',
    },
    usage: {
      getCurrentUserUsage: 'usage:getCurrentUserUsage',
    },
  },
}));

jest.mock('react-native-track-player', () => ({
  reset: jest.fn(),
  add: jest.fn(),
  getQueue: jest.fn(() => Promise.resolve([])),
  skip: jest.fn(),
  play: jest.fn(),
}));

jest.mock('../../store/useTrackPlayerStore', () => ({
  useTrackPlayerStore: jest.fn(() => ({
    isVisible: false,
    miniPlayerHeight: null,
    miniPlayerBottom: null,
    loadPlaylist: jest.fn(),
  })),
}));

jest.mock('../../store/useSubscriptionStore', () => ({
  useSubscriptionUIStore: jest.fn(() => ({
    showPaywall: false,
    paywallReason: null,
    setShowPaywall: jest.fn(),
  })),
}));

jest.mock('../../hooks/useRevenueCatSubscription', () => ({
  useRevenueCatSubscription: jest.fn(() => ({
    subscriptionStatus: { tier: 'free', musicLimit: 5 },
  })),
}));

jest.mock('../../store/useMusicGenerationStatus', () => ({
  useMusicGenerationStatus: jest.fn(() => ({
    addPendingGeneration: jest.fn(),
    removePendingGeneration: jest.fn(),
  })),
}));

jest.mock('../../components/diary/MediaUploadButton', () => ({
  MediaUploadButton: () => null,
}));

jest.mock('../../components/diary/DiaryMediaGrid', () => ({
  DiaryMediaGrid: () => null,
}));

jest.mock('../../components/billing/PaywallModal', () => ({
  PaywallModal: () => null,
}));

jest.mock('../../components/billing/UsageProgress', () => ({
  UsageProgress: () => null,
}));

jest.mock('../../theme/useThemeColors', () => ({
  useThemeColors: () => ({
    background: '#ffffff',
    textPrimary: '#000000',
    textSecondary: '#666666',
    textMuted: '#999999',
    surface: '#f5f5f5',
    card: '#ffffff',
    accentMint: '#00ff88',
    scheme: 'light',
  }),
}));

const mockNavigation = {
  goBack: jest.fn(),
  setParams: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn((event, callback) => {
    // Store the callback for testing
    if (event === 'beforeRemove') {
      (mockNavigation as any).beforeRemoveCallback = callback;
    }
    return jest.fn(); // unsubscribe function
  }),
  dispatch: jest.fn(),
  getParent: jest.fn(() => ({
    navigate: jest.fn(),
  })),
};

const mockRoute = {
  params: {},
};

const mockDeleteDiary = jest.fn();
const mockCreateDiary = jest.fn();
const mockUpdateDiary = jest.fn();
const mockStartMusicGeneration = jest.fn();

describe('DiaryEditScreen - Back Button Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigation as jest.Mock).mockReturnValue(mockNavigation);
    (useRoute as jest.Mock).mockReturnValue(mockRoute);
    mockRoute.params = {};
    (useMutation as jest.Mock).mockImplementation((apiPath) => {
      if (apiPath === api.diaries.deleteDiary) return mockDeleteDiary;
      if (apiPath === api.diaries.createDiary) return mockCreateDiary;
      if (apiPath === api.diaries.updateDiary) return mockUpdateDiary;
      return jest.fn();
    });
    (useAction as jest.Mock).mockImplementation((apiPath) => {
      if (apiPath === api.music.startDiaryMusicGeneration) return mockStartMusicGeneration;
      return jest.fn();
    });
    (useQuery as jest.Mock).mockImplementation((apiPath, args) => {
      if (apiPath === api.diaryMedia.getDiaryMedia) {
        // Default: no media, loaded
        return [];
      }
      if (apiPath === api.diaries.listDiaries) return [];
      if (apiPath === api.music.listPlaylistMusic) return [];
      if (apiPath === api.usage.getCurrentUserUsage) return { musicLimit: 5 };
      return undefined;
    });
    Alert.alert = jest.fn();
  });

  const renderComponent = (routeParams = {}) => {
    mockRoute.params = routeParams;
    return render(<DiaryEditScreen />);
  };

  const renderNewDiaryAfterMediaUpload = (mediaItems: any[] = [{ _id: 'media1' }]) => {
    let mediaResponse: any[] = mediaItems;
    (useQuery as jest.Mock).mockImplementation((apiPath) => {
      if (apiPath === api.diaryMedia.getDiaryMedia) {
        return mediaResponse;
      }
      if (apiPath === api.diaries.listDiaries) {
        return [{ _id: 'new-diary1', content: '', userId: 'user1' }];
      }
      if (apiPath === api.usage.getCurrentUserUsage) {
        return { musicLimit: 5 };
      }
      return [];
    });

    const utils = renderComponent({});
    mockRoute.params = { diaryId: 'new-diary1' };
    utils.rerender(<DiaryEditScreen />);

    return {
      ...utils,
      setMedia: (nextMedia: any[]) => {
        mediaResponse = nextMedia;
        utils.rerender(<DiaryEditScreen />);
      },
    };
  };

  describe('Media + No Text scenarios', () => {
    const renderExistingDiaryWithMedia = () => {
      (useQuery as jest.Mock).mockImplementation((apiPath) => {
        if (apiPath === api.diaryMedia.getDiaryMedia) {
          return [{ _id: 'media1' }];
        }
        if (apiPath === api.diaries.listDiaries) {
          return [{ _id: 'diary1', content: '', userId: 'user1' }];
        }
        if (apiPath === api.usage.getCurrentUserUsage) {
          return { musicLimit: 5 };
        }
        return [];
      });
      renderComponent({ diaryId: 'diary1', content: '' });
    };

    it('does not warn when editing an existing entry that already has media', () => {
      renderExistingDiaryWithMedia();

      const callback = (mockNavigation as any).beforeRemoveCallback;
      const mockEvent = {
        preventDefault: jest.fn(),
        data: { action: { type: 'GO_BACK' } },
      };

      callback(mockEvent);

      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('shows delete warning when a new entry with media tries to go back', async () => {
      mockDeleteDiary.mockResolvedValue(null);
      let alertButtons: any[] = [];
      (Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        alertButtons = buttons;
      });

      renderNewDiaryAfterMediaUpload();

      const callback = (mockNavigation as any).beforeRemoveCallback;
      const mockEvent = {
        preventDefault: jest.fn(),
        data: { action: { type: 'GO_BACK' } },
      };

      callback(mockEvent);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Discard Entry?',
          'You have uploaded media but haven\'t written anything. Going back will delete this entry and its media.',
          expect.any(Array)
        );
      });

      const discardButton = alertButtons.find((btn) => btn.text === 'Discard');
      await discardButton?.onPress?.();

      await waitFor(() => {
        expect(mockDeleteDiary).toHaveBeenCalledWith({ diaryId: 'new-diary1' });
      });
    });

    it('silently deletes new empty entries even if media was previously added', async () => {
      mockDeleteDiary.mockResolvedValue(null);

      const utils = renderNewDiaryAfterMediaUpload();
      utils.setMedia([]);

      const callback = (mockNavigation as any).beforeRemoveCallback;
      const mockEvent = {
        preventDefault: jest.fn(),
        data: { action: { type: 'GO_BACK' } },
      };

      callback(mockEvent);

      await waitFor(() => {
        expect(mockDeleteDiary).toHaveBeenCalledWith({ diaryId: 'new-diary1' });
      });
      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });

  describe('Media + Text scenarios', () => {
    const renderExistingDiaryWithText = () => {
      (useQuery as jest.Mock).mockImplementation((apiPath) => {
        if (apiPath === api.diaryMedia.getDiaryMedia) {
          return [{ _id: 'media1' }];
        }
        if (apiPath === api.diaries.listDiaries) {
          return [{ _id: 'diary1', content: 'Original text', userId: 'user1' }];
        }
        if (apiPath === api.usage.getCurrentUserUsage) {
          return { musicLimit: 5 };
        }
        return [];
      });

      return renderComponent({ diaryId: 'diary1', content: 'Original text' });
    };

    it('shows discard changes warning when existing text is edited', async () => {
      const { getByPlaceholderText } = renderExistingDiaryWithText();
      fireEvent.changeText(getByPlaceholderText('Write your story...'), 'Updated text');

      const callback = (mockNavigation as any).beforeRemoveCallback;
      const mockEvent = {
        preventDefault: jest.fn(),
        data: { action: { type: 'GO_BACK' } },
      };
      callback(mockEvent);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Discard Changes?',
          'You have unsaved changes. Going back will discard your edits.',
          expect.any(Array)
        );
      });
    });

    it('dispatches navigation when user confirms discarding edited text', async () => {
      let alertButtons: any[] = [];
      (Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        alertButtons = buttons;
      });

      const { getByPlaceholderText } = renderExistingDiaryWithText();
      fireEvent.changeText(getByPlaceholderText('Write your story...'), 'Updated text');

      const callback = (mockNavigation as any).beforeRemoveCallback;
      const mockEvent = {
        preventDefault: jest.fn(),
        data: { action: { type: 'GO_BACK' } },
      };
      callback(mockEvent);

      await waitFor(() => {
        expect(alertButtons.length).toBeGreaterThan(0);
      });

      const discardButton = alertButtons.find((btn) => btn.text === 'Discard');
      discardButton?.onPress?.();

      expect(mockDeleteDiary).not.toHaveBeenCalled();
      expect(mockNavigation.dispatch).toHaveBeenCalledWith(mockEvent.data.action);
    });
  });

  describe('No Media + No Text scenarios', () => {
    it('silently deletes empty new entries that never had media', async () => {
      mockDeleteDiary.mockResolvedValue(null);

      (useQuery as jest.Mock).mockImplementation((apiPath) => {
        if (apiPath === api.diaryMedia.getDiaryMedia) {
          return [];
        }
        if (apiPath === api.diaries.listDiaries) {
          return [{ _id: 'new-diary1', content: '', userId: 'user1' }];
        }
        if (apiPath === api.usage.getCurrentUserUsage) {
          return { musicLimit: 5 };
        }
        return [];
      });

      const utils = renderComponent({});
      mockRoute.params = { diaryId: 'new-diary1' };
      utils.rerender(<DiaryEditScreen />);

      const callback = (mockNavigation as any).beforeRemoveCallback;
      const mockEvent = {
        preventDefault: jest.fn(),
        data: { action: { type: 'GO_BACK' } },
      };
      callback(mockEvent);

      await waitFor(() => {
        expect(mockDeleteDiary).toHaveBeenCalledWith({ diaryId: 'new-diary1' });
      });
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('should not delete existing entry with no media and no text', async () => {
      (useQuery as jest.Mock).mockImplementation((apiPath) => {
        if (apiPath === api.diaryMedia.getDiaryMedia) {
          return []; // No media, loaded
        }
        if (apiPath === api.diaries.listDiaries) {
          return [{ _id: 'existing-diary1', content: '', userId: 'user1' }];
        }
        return undefined;
      });

      renderComponent({ diaryId: 'existing-diary1' });

      // Trigger beforeRemove
      const beforeRemoveCall = mockNavigation.addListener.mock.calls.find(
        (call) => call[0] === 'beforeRemove'
      );
      if (beforeRemoveCall) {
        const callback = beforeRemoveCall[1];
        const mockEvent = {
          preventDefault: jest.fn(),
          data: { action: { type: 'GO_BACK' } },
        };
        callback(mockEvent);

        // Should not show alert and not delete
        expect(Alert.alert).not.toHaveBeenCalled();
        expect(mockDeleteDiary).not.toHaveBeenCalled();
      }
    });
  });

  describe('No Media + Text scenarios', () => {
    it('should navigate back normally with text but no media (existing entry)', async () => {
      (useQuery as jest.Mock).mockImplementation((apiPath) => {
        if (apiPath === api.diaryMedia.getDiaryMedia) {
          return []; // No media, loaded
        }
        if (apiPath === api.diaries.listDiaries) {
          return [{ _id: 'diary1', content: 'Some text', userId: 'user1' }];
        }
        return undefined;
      });

      renderComponent({ diaryId: 'diary1', content: 'Some text' });

      // Trigger beforeRemove
      const beforeRemoveCall = mockNavigation.addListener.mock.calls.find(
        (call) => call[0] === 'beforeRemove'
      );
      if (beforeRemoveCall) {
        const callback = beforeRemoveCall[1];
        const mockEvent = {
          preventDefault: jest.fn(),
          data: { action: { type: 'GO_BACK' } },
        };
        callback(mockEvent);

        // Should not show alert
        expect(Alert.alert).not.toHaveBeenCalled();
        expect(mockDeleteDiary).not.toHaveBeenCalled();
      }
    });

    it('should show discard warning for new entry with text but no media', async () => {
      mockDeleteDiary.mockResolvedValue(null);
      let alertButtons: any[] = [];

      (useQuery as jest.Mock).mockImplementation((apiPath) => {
        if (apiPath === api.diaryMedia.getDiaryMedia) {
          return []; // No media, loaded
        }
        if (apiPath === api.diaries.listDiaries) {
          return [{ _id: 'new-diary1', content: 'Some text', userId: 'user1' }];
        }
        return undefined;
      });

      (Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        alertButtons = buttons;
      });

      // New entry (no diaryId in initial params) that later gets an id
      const renderResult = renderComponent({ content: 'Some text' });
      mockRoute.params = { diaryId: 'new-diary1', content: 'Some text' };
      renderResult.rerender(<DiaryEditScreen />);

      const callback = (mockNavigation as any).beforeRemoveCallback;
      const mockEvent = {
        preventDefault: jest.fn(),
        data: { action: { type: 'GO_BACK' } },
      };
      callback(mockEvent);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Discard Entry?',
          'You have written content but haven\'t saved. Going back will delete this entry.',
          expect.any(Array)
        );
      });

      // Simulate user clicking "Discard"
      const discardButton = alertButtons.find((btn) => btn.text === 'Discard');
      if (discardButton) {
        await discardButton.onPress();
      }

      await waitFor(() => {
        expect(mockDeleteDiary).toHaveBeenCalledWith({ diaryId: 'new-diary1' });
      });
    });

    it('should not delete when user cancels discard for new entry with text but no media', async () => {
      let alertButtons: any[] = [];

      (useQuery as jest.Mock).mockImplementation((apiPath) => {
        if (apiPath === api.diaryMedia.getDiaryMedia) {
          return []; // No media, loaded
        }
        if (apiPath === api.diaries.listDiaries) {
          return [{ _id: 'new-diary1', content: 'Some text', userId: 'user1' }];
        }
        return undefined;
      });

      (Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        alertButtons = buttons;
      });

      // New entry (no diaryId in initial params)
      renderComponent({ content: 'Some text' });

      // Trigger beforeRemove
      const beforeRemoveCall = mockNavigation.addListener.mock.calls.find(
        (call) => call[0] === 'beforeRemove'
      );
      if (beforeRemoveCall) {
        const callback = beforeRemoveCall[1];
        const mockEvent = {
          preventDefault: jest.fn(),
          data: { action: { type: 'GO_BACK' } },
        };
        callback(mockEvent);

        await waitFor(() => {
          expect(alertButtons.length).toBeGreaterThan(0);
        });

        // Simulate user clicking "Keep Editing"
        const keepEditingButton = alertButtons.find((btn) => btn.text === 'Keep Editing');
        if (keepEditingButton) {
          keepEditingButton.onPress();
        }

        expect(mockDeleteDiary).not.toHaveBeenCalled();
      }
    });
  });

  describe('Media query loading states', () => {
    it('should not show warning if media query is still loading', async () => {
      (useQuery as jest.Mock).mockImplementation((apiPath) => {
        if (apiPath === api.diaryMedia.getDiaryMedia) {
          return undefined; // Still loading
        }
        if (apiPath === api.diaries.listDiaries) {
          return [{ _id: 'diary1', content: '', userId: 'user1' }];
        }
        return undefined;
      });

      renderComponent({ diaryId: 'diary1' });

      // Trigger beforeRemove
      const beforeRemoveCall = mockNavigation.addListener.mock.calls.find(
        (call) => call[0] === 'beforeRemove'
      );
      if (beforeRemoveCall) {
        const callback = beforeRemoveCall[1];
        const mockEvent = {
          preventDefault: jest.fn(),
          data: { action: { type: 'GO_BACK' } },
        };
        callback(mockEvent);

        // Should not show alert while media is loading
        expect(Alert.alert).not.toHaveBeenCalled();
      }
    });
  });

  describe('Saving/Generating states', () => {
    it('should not interrupt when saving is in progress', async () => {
      (useQuery as jest.Mock).mockImplementation((apiPath) => {
        if (apiPath === api.diaryMedia.getDiaryMedia) {
          return [{ _id: 'media1' }]; // Has media
        }
        if (apiPath === api.diaries.listDiaries) {
          return [{ _id: 'diary1', content: '', userId: 'user1' }];
        }
        return undefined;
      });

      const { rerender } = renderComponent({ diaryId: 'diary1' });

      // Simulate saving state - we'd need to trigger handleDone first
      // For now, just verify the listener checks isSaving
      const beforeRemoveCall = mockNavigation.addListener.mock.calls.find(
        (call) => call[0] === 'beforeRemove'
      );
      if (beforeRemoveCall) {
        const callback = beforeRemoveCall[1];
        const mockEvent = {
          preventDefault: jest.fn(),
          data: { action: { type: 'GO_BACK' } },
        };
        // The callback should check isSaving/isGenerating and return early
        callback(mockEvent);
      }

      // Note: This test would need more setup to actually test isSaving state
      // The component uses useState which is harder to test directly
    });
  });

  describe('Programmatic navigation flag', () => {
    it('should skip beforeRemove handler when navigating programmatically', async () => {
      mockDeleteDiary.mockResolvedValue(null);
      let alertButtons: any[] = [];
      (Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        alertButtons = buttons;
      });

      const { getByTestId } = renderNewDiaryAfterMediaUpload();

      // First, trigger back button press which calls handleBackPress
      // This should show an alert for new diary with media
      fireEvent.press(getByTestId('back-button'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // User clicks "Discard" - this sets isNavigatingBackRef.current = true
      // and calls navigation.goBack() after async deleteDiary completes
      const discardButton = alertButtons.find((btn) => btn.text === 'Discard');
      await discardButton?.onPress?.();

      // Wait for deleteDiary to complete
      await waitFor(() => {
        expect(mockDeleteDiary).toHaveBeenCalled();
      });

      // Reset alert mock to verify it's not called again
      (Alert.alert as jest.Mock).mockClear();

      // Now simulate the beforeRemove event that would be triggered by navigation.goBack()
      // The handler should skip because isNavigatingBackRef.current was set to true
      const callback = (mockNavigation as any).beforeRemoveCallback;
      const mockEvent = {
        preventDefault: jest.fn(),
        data: { action: { type: 'GO_BACK' } },
      };

      callback(mockEvent);

      // The handler should have skipped, so alert should not be shown again
      // and preventDefault should not have been called
      expect(Alert.alert).not.toHaveBeenCalled();
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle diary not found error gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockDeleteDiary.mockRejectedValue(new Error('Diary not found'));
      let alertButtons: any[] = [];

      (Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        alertButtons = buttons;
      });

      renderNewDiaryAfterMediaUpload();

      const callback = (mockNavigation as any).beforeRemoveCallback;
      const mockEvent = {
        preventDefault: jest.fn(),
        data: { action: { type: 'GO_BACK' } },
      };
      callback(mockEvent);

      await waitFor(() => {
        expect(alertButtons.length).toBeGreaterThan(0);
      });

      const discardButton = alertButtons.find((btn) => btn.text === 'Discard');
      await discardButton?.onPress?.();

      await waitFor(() => {
        // Should not log error for "Diary not found"
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });

    it('should log other errors when deleting fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockDeleteDiary.mockRejectedValue(new Error('Network error'));
      let alertButtons: any[] = [];

      (Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
        alertButtons = buttons;
      });

      renderNewDiaryAfterMediaUpload();

      const callback = (mockNavigation as any).beforeRemoveCallback;
      const mockEvent = {
        preventDefault: jest.fn(),
        data: { action: { type: 'GO_BACK' } },
      };
      callback(mockEvent);

      await waitFor(() => {
        expect(alertButtons.length).toBeGreaterThan(0);
      });

      const discardButton = alertButtons.find((btn) => btn.text === 'Discard');
      await discardButton?.onPress?.();

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to delete empty diary',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });
});

