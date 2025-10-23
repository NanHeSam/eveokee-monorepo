import { create } from 'zustand';
import type { Id } from '@backend/convex/convex/_generated/dataModel';

type PendingGeneration = {
  diaryId: Id<'diaries'>;
  startedAt: number;
};

type MusicGenerationStatusState = {
  pendingGenerations: PendingGeneration[];
  addPendingGeneration: (diaryId: Id<'diaries'>) => void;
  removePendingGeneration: (diaryId: Id<'diaries'>) => void;
};

export const useMusicGenerationStatus = create<MusicGenerationStatusState>((set) => ({
  pendingGenerations: [],
  addPendingGeneration: (diaryId) =>
    set((state) => {
      if (state.pendingGenerations.some((entry) => entry.diaryId === diaryId)) {
        return state;
      }
      return {
        pendingGenerations: [
          ...state.pendingGenerations,
          {
            diaryId,
            startedAt: Date.now(),
          },
        ],
      };
    }),
  removePendingGeneration: (diaryId) =>
    set((state) => ({
      pendingGenerations: state.pendingGenerations.filter((entry) => entry.diaryId !== diaryId),
    })),
}));

