import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { useAudioManager } from '../hooks/useAudioManager';

interface MusicPlayerProps {
  audioId: string;
  audioUrl: string;
  startTime?: number;
  duration: string;
  onPlay?: () => void;
  className?: string;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const parseTimeString = (timeString: string): number => {
  const [mins, secs] = timeString.split(':').map(Number);
  return mins * 60 + secs;
};

export default function MusicPlayer({ 
  audioId, 
  audioUrl, 
  startTime = 0, 
  duration, 
  onPlay,
  className = '' 
}: MusicPlayerProps) {
  const audioManager = useAudioManager();
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  const isCurrentAudio = audioManager.isCurrentAudio(audioId);
  const isPlaying = isCurrentAudio && audioManager.isPlaying;
  const isLoading = isCurrentAudio && audioManager.isLoading;
  
  const currentTime = isCurrentAudio ? audioManager.currentTime : 0;
  const totalDuration = isCurrentAudio ? audioManager.duration : parseTimeString(duration);
  
  // Calculate progress percentage
  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const displayProgress = isDragging ? dragProgress : progress;

  const handlePlayToggle = async () => {
    await audioManager.toggleAudio(audioId, audioUrl, startTime);
    if (onPlay) {
      onPlay();
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !isCurrentAudio) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progressPercent = (clickX / rect.width) * 100;
    const newTime = (progressPercent / 100) * totalDuration;
    
    audioManager.seekTo(newTime);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCurrentAudio) return;
    
    setIsDragging(true);
    handleMouseMove(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !progressBarRef.current) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progressPercent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    
    setDragProgress(progressPercent);
  };

  const handleMouseUp = () => {
    if (!isDragging || !isCurrentAudio) return;
    
    const newTime = (dragProgress / 100) * totalDuration;
    audioManager.seekTo(newTime);
    setIsDragging(false);
  };

  // Global mouse events for dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging || !progressBarRef.current) return;
      
      const rect = progressBarRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const progressPercent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
      
      setDragProgress(progressPercent);
    };

    const handleGlobalMouseUp = () => {
      if (!isDragging || !isCurrentAudio) return;
      
      const newTime = (dragProgress / 100) * totalDuration;
      audioManager.seekTo(newTime);
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragProgress, totalDuration, audioManager, isCurrentAudio]);

  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      {/* Play/Pause Button */}
      <button
        onClick={handlePlayToggle}
        disabled={isLoading}
        className="inline-flex items-center justify-center w-12 h-12 bg-gray-900 dark:bg-gray-700 text-white rounded-full hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex-shrink-0"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-5 h-5" />
        ) : (
          <Play className="w-5 h-5 ml-0.5" />
        )}
      </button>

      {/* Progress Bar and Time Display */}
      <div className="flex-1 min-w-0">
        {/* Time Display */}
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
            {formatTime(currentTime)}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {duration}
          </span>
        </div>

        {/* Progress Bar */}
        <div
          ref={progressBarRef}
          className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer group"
          onClick={handleProgressBarClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Progress Fill */}
          <div
            className="absolute top-0 left-0 h-full bg-gray-900 dark:bg-gray-300 rounded-full transition-all duration-150 ease-out group-hover:bg-gray-800 dark:group-hover:bg-gray-200"
            style={{ width: `${displayProgress}%` }}
          />
          
          {/* Drag Handle */}
          {isCurrentAudio && (
            <div
              className={`absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-gray-900 dark:bg-gray-300 rounded-full shadow-md transition-all duration-150 ${
                isDragging ? 'scale-125' : 'scale-0 group-hover:scale-100'
              }`}
              style={{ left: `calc(${displayProgress}% - 8px)` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}