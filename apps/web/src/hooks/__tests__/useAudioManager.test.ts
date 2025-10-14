import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useAudioManager } from "../useAudioManager";

describe("useAudioManager", () => {
  let mockAudio: any;
  let audioInstances: any[] = [];

  beforeEach(() => {
    audioInstances = [];

    global.Audio = class MockAudio {
      src: string = "";
      currentTime: number = 0;
      duration: number = 0;
      paused: boolean = true;
      ended: boolean = false;
      volume: number = 1;
      private listeners: { [key: string]: Function[] } = {};

      constructor(src?: string) {
        if (src) this.src = src;
        audioInstances.push(this);
        mockAudio = this;
      }

      addEventListener(event: string, handler: Function) {
        if (!this.listeners[event]) {
          this.listeners[event] = [];
        }
        this.listeners[event].push(handler);
      }

      removeEventListener(event: string, handler: Function) {
        if (this.listeners[event]) {
          this.listeners[event] = this.listeners[event].filter(h => h !== handler);
        }
      }

      async play() {
        this.paused = false;
        return Promise.resolve();
      }

      pause() {
        this.paused = true;
      }

      trigger(event: string, data?: any) {
        if (this.listeners[event]) {
          this.listeners[event].forEach(handler => handler(data));
        }
      }
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    audioInstances = [];
  });

  it("should initialize with default state", () => {
    const { result } = renderHook(() => useAudioManager());

    expect(result.current.currentAudioId).toBeNull();
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.currentTime).toBe(0);
    expect(result.current.duration).toBe(0);
  });

  it("should create Audio element and play when playAudio is called", async () => {
    const { result } = renderHook(() => useAudioManager());

    await act(async () => {
      await result.current.playAudio("audio1", "http://test.mp3");
    });

    expect(audioInstances.length).toBe(1);
    expect(audioInstances[0].src).toBe("http://test.mp3");
    expect(result.current.currentAudioId).toBe("audio1");
    expect(result.current.isPlaying).toBe(true);
  });

  it("should set loading state during audio loading", async () => {
    const { result } = renderHook(() => useAudioManager());

    act(() => {
      result.current.playAudio("audio1", "http://test.mp3");
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isPlaying).toBe(true);
    });
  });

  it("should trigger canplay event to clear loading state", async () => {
    const { result } = renderHook(() => useAudioManager());

    await act(async () => {
      await result.current.playAudio("audio1", "http://test.mp3");
    });

    act(() => {
      mockAudio.trigger("loadstart");
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      mockAudio.trigger("canplay");
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("should pause audio when pauseAudio is called", async () => {
    const { result } = renderHook(() => useAudioManager());

    await act(async () => {
      await result.current.playAudio("audio1", "http://test.mp3");
    });

    expect(result.current.isPlaying).toBe(true);

    act(() => {
      result.current.pauseAudio();
    });

    expect(result.current.isPlaying).toBe(false);
    expect(mockAudio.paused).toBe(true);
  });

  it("should toggle between play and pause", async () => {
    const { result } = renderHook(() => useAudioManager());

    await act(async () => {
      await result.current.toggleAudio("audio1", "http://test.mp3");
    });

    expect(result.current.isPlaying).toBe(true);

    await act(async () => {
      await result.current.toggleAudio("audio1", "http://test.mp3");
    });

    expect(result.current.isPlaying).toBe(false);

    await act(async () => {
      await result.current.toggleAudio("audio1", "http://test.mp3");
    });

    expect(result.current.isPlaying).toBe(true);
  });

  it("should cleanup and create new Audio when switching tracks", async () => {
    const { result } = renderHook(() => useAudioManager());

    await act(async () => {
      await result.current.playAudio("audio1", "http://test1.mp3");
    });

    expect(audioInstances.length).toBe(1);
    expect(result.current.currentAudioId).toBe("audio1");

    await act(async () => {
      await result.current.playAudio("audio2", "http://test2.mp3");
    });

    expect(audioInstances.length).toBe(2);
    expect(result.current.currentAudioId).toBe("audio2");
    expect(audioInstances[0].paused).toBe(true); // Previous audio should be paused
  });

  it("should update currentTime when timeupdate event fires", async () => {
    const { result } = renderHook(() => useAudioManager());

    await act(async () => {
      await result.current.playAudio("audio1", "http://test.mp3");
    });

    act(() => {
      mockAudio.currentTime = 45.5;
      mockAudio.trigger("timeupdate");
    });

    expect(result.current.currentTime).toBe(45.5);
  });

  it("should update duration when loadedmetadata event fires", async () => {
    const { result } = renderHook(() => useAudioManager());

    await act(async () => {
      await result.current.playAudio("audio1", "http://test.mp3");
    });

    act(() => {
      mockAudio.duration = 180.25;
      mockAudio.trigger("loadedmetadata");
    });

    expect(result.current.duration).toBe(180.25);
  });

  it("should seek to specific time", async () => {
    const { result } = renderHook(() => useAudioManager());

    await act(async () => {
      await result.current.playAudio("audio1", "http://test.mp3");
    });

    act(() => {
      mockAudio.duration = 200;
      mockAudio.trigger("loadedmetadata");
    });

    act(() => {
      result.current.seekTo(75);
    });

    expect(mockAudio.currentTime).toBe(75);
    expect(result.current.currentTime).toBe(75);
  });

  it("should clamp seek time to duration bounds", async () => {
    const { result } = renderHook(() => useAudioManager());

    await act(async () => {
      await result.current.playAudio("audio1", "http://test.mp3");
    });

    act(() => {
      mockAudio.duration = 100;
      mockAudio.trigger("loadedmetadata");
    });

    act(() => {
      result.current.seekTo(150);
    });

    expect(mockAudio.currentTime).toBe(100);

    act(() => {
      result.current.seekTo(-10);
    });

    expect(mockAudio.currentTime).toBe(0);
  });

  it("should reset state when audio ends", async () => {
    const { result } = renderHook(() => useAudioManager());

    await act(async () => {
      await result.current.playAudio("audio1", "http://test.mp3");
    });

    expect(result.current.isPlaying).toBe(true);

    act(() => {
      mockAudio.trigger("ended");
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentAudioId).toBeNull();
    expect(result.current.currentTime).toBe(0);
  });

  it("should handle audio errors", async () => {
    const { result } = renderHook(() => useAudioManager());

    await act(async () => {
      await result.current.playAudio("audio1", "http://test.mp3");
    });

    act(() => {
      mockAudio.trigger("error");
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.error).toBe("Failed to load audio");
    expect(result.current.currentTime).toBe(0);
  });

  it("should set error when play fails", async () => {
    global.Audio = class MockAudioFail {
      src: string = "";
      currentTime: number = 0;
      duration: number = 0;
      paused: boolean = true;
      private listeners: { [key: string]: Function[] } = {};

      constructor(src?: string) {
        if (src) this.src = src;
        audioInstances.push(this);
        mockAudio = this;
      }

      addEventListener(event: string, handler: Function) {
        if (!this.listeners[event]) {
          this.listeners[event] = [];
        }
        this.listeners[event].push(handler);
      }

      removeEventListener() {}

      async play() {
        throw new Error("Play failed");
      }

      pause() {
        this.paused = true;
      }
    } as any;

    const { result } = renderHook(() => useAudioManager());

    await act(async () => {
      await result.current.playAudio("audio1", "http://test.mp3");
    });

    expect(result.current.error).toBe("Failed to play audio");
    expect(result.current.isPlaying).toBe(false);
  });

  it("should support starting audio at specific time", async () => {
    const { result } = renderHook(() => useAudioManager());

    await act(async () => {
      await result.current.playAudio("audio1", "http://test.mp3", 30);
    });

    expect(mockAudio.currentTime).toBe(30);
    expect(result.current.isPlaying).toBe(true);
  });

  it("should correctly identify current audio", async () => {
    const { result } = renderHook(() => useAudioManager());

    expect(result.current.isCurrentAudio("audio1")).toBe(false);

    await act(async () => {
      await result.current.playAudio("audio1", "http://test.mp3");
    });

    expect(result.current.isCurrentAudio("audio1")).toBe(true);
    expect(result.current.isCurrentAudio("audio2")).toBe(false);
  });

  it("should cleanup audio on unmount", async () => {
    const { result, unmount } = renderHook(() => useAudioManager());

    await act(async () => {
      await result.current.playAudio("audio1", "http://test.mp3");
    });

    const currentAudio = mockAudio;

    unmount();

    expect(currentAudio.paused).toBe(true);
  });

  it("should not create new Audio if same track is already playing", async () => {
    const { result } = renderHook(() => useAudioManager());

    await act(async () => {
      await result.current.playAudio("audio1", "http://test.mp3");
    });

    expect(audioInstances.length).toBe(1);

    await act(async () => {
      await result.current.playAudio("audio1", "http://test.mp3");
    });

    expect(audioInstances.length).toBe(1);
  });

  it("should handle rapid track switching", async () => {
    const { result } = renderHook(() => useAudioManager());

    await act(async () => {
      await result.current.playAudio("audio1", "http://test1.mp3");
      await result.current.playAudio("audio2", "http://test2.mp3");
      await result.current.playAudio("audio3", "http://test3.mp3");
    });

    expect(result.current.currentAudioId).toBe("audio3");
    expect(audioInstances.length).toBe(3);
    expect(audioInstances[0].paused).toBe(true);
    expect(audioInstances[1].paused).toBe(true);
  });
});
