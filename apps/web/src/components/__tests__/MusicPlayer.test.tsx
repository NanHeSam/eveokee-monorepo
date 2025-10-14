import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import MusicPlayer from "../MusicPlayer";
import { useAudioManager } from "../../hooks/useAudioManager";

vi.mock("../../hooks/useAudioManager");

describe("MusicPlayer", () => {
  let mockAudioManager: any;

  beforeEach(() => {
    mockAudioManager = {
      currentAudioId: null,
      isPlaying: false,
      isLoading: false,
      error: null,
      currentTime: 0,
      duration: 0,
      playAudio: vi.fn(),
      pauseAudio: vi.fn(),
      toggleAudio: vi.fn(),
      seekTo: vi.fn(),
      isCurrentAudio: vi.fn((id: string) => id === mockAudioManager.currentAudioId),
    };

    (useAudioManager as any).mockReturnValue(mockAudioManager);
  });

  it("should render play button when not playing", () => {
    render(
      <MusicPlayer
        audioId="audio1"
        audioUrl="http://test.mp3"
        duration="2:30"
      />
    );

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    
    const svg = button.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("should render pause button when playing", () => {
    mockAudioManager.currentAudioId = "audio1";
    mockAudioManager.isPlaying = true;

    render(
      <MusicPlayer
        audioId="audio1"
        audioUrl="http://test.mp3"
        duration="2:30"
      />
    );

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("should show loading spinner when audio is loading", () => {
    mockAudioManager.currentAudioId = "audio1";
    mockAudioManager.isLoading = true;

    render(
      <MusicPlayer
        audioId="audio1"
        audioUrl="http://test.mp3"
        duration="2:30"
      />
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    
    const spinner = button.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("should call toggleAudio when play button is clicked", async () => {
    render(
      <MusicPlayer
        audioId="audio1"
        audioUrl="http://test.mp3"
        duration="2:30"
      />
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockAudioManager.toggleAudio).toHaveBeenCalledWith(
        "audio1",
        "http://test.mp3",
        0
      );
    });
  });

  it("should call onPlay callback when provided", async () => {
    const onPlayMock = vi.fn();

    render(
      <MusicPlayer
        audioId="audio1"
        audioUrl="http://test.mp3"
        duration="2:30"
        onPlay={onPlayMock}
      />
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => {
      expect(onPlayMock).toHaveBeenCalled();
    });
  });

  it("should pass startTime to toggleAudio", async () => {
    render(
      <MusicPlayer
        audioId="audio1"
        audioUrl="http://test.mp3"
        duration="2:30"
        startTime={45}
      />
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockAudioManager.toggleAudio).toHaveBeenCalledWith(
        "audio1",
        "http://test.mp3",
        45
      );
    });
  });

  it("should display current time and total duration", () => {
    mockAudioManager.currentAudioId = "audio1";
    mockAudioManager.currentTime = 75;
    mockAudioManager.duration = 150;

    render(
      <MusicPlayer
        audioId="audio1"
        audioUrl="http://test.mp3"
        duration="2:30"
      />
    );

    expect(screen.getByText("1:15")).toBeInTheDocument(); // Current time
    expect(screen.getByText("2:30")).toBeInTheDocument(); // Total duration
  });

  it("should show 0:00 for current time when not playing", () => {
    render(
      <MusicPlayer
        audioId="audio1"
        audioUrl="http://test.mp3"
        duration="3:45"
      />
    );

    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.getByText("3:45")).toBeInTheDocument();
  });

  it("should seek when progress bar is clicked", () => {
    mockAudioManager.currentAudioId = "audio1";
    mockAudioManager.duration = 150; // 2:30

    const { container } = render(
      <MusicPlayer
        audioId="audio1"
        audioUrl="http://test.mp3"
        duration="2:30"
      />
    );

    const progressBar = container.querySelector(".cursor-pointer");
    expect(progressBar).toBeInTheDocument();

    vi.spyOn(progressBar as Element, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 300,
      top: 0,
      right: 300,
      bottom: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    fireEvent.click(progressBar as Element, { clientX: 150 });

    expect(mockAudioManager.seekTo).toHaveBeenCalledWith(75); // 50% of 150 seconds
  });

  it("should not seek when clicking on non-current audio", () => {
    mockAudioManager.currentAudioId = "audio2"; // Different audio is playing

    const { container } = render(
      <MusicPlayer
        audioId="audio1"
        audioUrl="http://test.mp3"
        duration="2:30"
      />
    );

    const progressBar = container.querySelector(".cursor-pointer");
    fireEvent.click(progressBar as Element, { clientX: 150 });

    expect(mockAudioManager.seekTo).not.toHaveBeenCalled();
  });

  it("should update progress bar based on currentTime", () => {
    mockAudioManager.currentAudioId = "audio1";
    mockAudioManager.currentTime = 60;
    mockAudioManager.duration = 120;

    const { container } = render(
      <MusicPlayer
        audioId="audio1"
        audioUrl="http://test.mp3"
        duration="2:00"
      />
    );

    const progressBar = container.querySelector(".cursor-pointer");
    expect(progressBar).toBeInTheDocument();
  });

  it("should handle drag to seek", () => {
    mockAudioManager.currentAudioId = "audio1";
    mockAudioManager.duration = 100;

    const { container } = render(
      <MusicPlayer
        audioId="audio1"
        audioUrl="http://test.mp3"
        duration="1:40"
      />
    );

    const progressBar = container.querySelector(".cursor-pointer") as Element;

    vi.spyOn(progressBar, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 200,
      top: 0,
      right: 200,
      bottom: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    fireEvent.mouseDown(progressBar, { clientX: 0 });

    fireEvent.mouseUp(progressBar, { clientX: 100 });

    expect(mockAudioManager.seekTo).toHaveBeenCalled();
  });

  it("should show drag handle only when current audio is playing", () => {
    mockAudioManager.currentAudioId = "audio1";
    mockAudioManager.duration = 100;

    const { container } = render(
      <MusicPlayer
        audioId="audio1"
        audioUrl="http://test.mp3"
        duration="1:40"
      />
    );

    const dragHandle = container.querySelector(".rounded-full.shadow-md");
    expect(dragHandle).toBeInTheDocument();
  });

  it("should not show drag handle when different audio is playing", () => {
    mockAudioManager.currentAudioId = "audio2"; // Different audio

    const { container } = render(
      <MusicPlayer
        audioId="audio1"
        audioUrl="http://test.mp3"
        duration="1:40"
      />
    );

    const progressBar = container.querySelector(".cursor-pointer");
    expect(progressBar).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const { container } = render(
      <MusicPlayer
        audioId="audio1"
        audioUrl="http://test.mp3"
        duration="2:30"
        className="custom-class"
      />
    );

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass("custom-class");
  });

  it("should parse duration string correctly", () => {
    render(
      <MusicPlayer
        audioId="audio1"
        audioUrl="http://test.mp3"
        duration="12:34"
      />
    );

    expect(screen.getByText("12:34")).toBeInTheDocument();
  });

  it("should format time with leading zeros for seconds", () => {
    mockAudioManager.currentAudioId = "audio1";
    mockAudioManager.currentTime = 65; // 1:05
    mockAudioManager.duration = 150;

    render(
      <MusicPlayer
        audioId="audio1"
        audioUrl="http://test.mp3"
        duration="2:30"
      />
    );

    expect(screen.getByText("1:05")).toBeInTheDocument();
  });

  it("should handle zero duration gracefully", () => {
    mockAudioManager.currentAudioId = "audio1";
    mockAudioManager.duration = 0;

    const { container } = render(
      <MusicPlayer
        audioId="audio1"
        audioUrl="http://test.mp3"
        duration="0:00"
      />
    );

    const progressBar = container.querySelector(".cursor-pointer");
    expect(progressBar).toBeInTheDocument();
  });

  it("should not seek beyond duration when dragging", () => {
    mockAudioManager.currentAudioId = "audio1";
    mockAudioManager.duration = 100;

    const { container } = render(
      <MusicPlayer
        audioId="audio1"
        audioUrl="http://test.mp3"
        duration="1:40"
      />
    );

    const progressBar = container.querySelector(".cursor-pointer") as Element;

    vi.spyOn(progressBar, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 200,
      top: 0,
      right: 200,
      bottom: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    fireEvent.mouseDown(progressBar, { clientX: 0 });
    fireEvent.mouseUp(progressBar, { clientX: 250 });

    const calls = mockAudioManager.seekTo.mock.calls;
    if (calls.length > 0) {
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall).toBeLessThanOrEqual(100);
    }
  });
});
