import { Play, Pause } from 'lucide-react';
import { useAudioManager } from '../hooks/useAudioManager';

interface EmotionalHookSectionProps {
  onPlayTrack?: () => void;
}

export default function EmotionalHookSection({ onPlayTrack }: EmotionalHookSectionProps) {
  const audioManager = useAudioManager();
  
  // Demo audio for this section
  const emotionalAudioUrl = 'https://cdn1.suno.ai/b28aad1b-2d89-44f9-9f06-0e4fe429f98e.mp3';
  const emotionalAudioId = 'emotional-demo';
  
  const handleAudioToggle = async () => {
    await audioManager.toggleAudio(emotionalAudioId, emotionalAudioUrl);
    
    if (onPlayTrack) {
      onPlayTrack();
    }
  };
  
  const isCurrentAudio = audioManager.isCurrentAudio(emotionalAudioId);
  const isPlaying = isCurrentAudio && audioManager.isPlaying;
  const isLoading = isCurrentAudio && audioManager.isLoading;

  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            A new way of journaling
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Your entries don't just sit on the page anymore. They play back the feeling of the moment.
          </p>
        </div>
        
        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Diary Snippet */}
          <div className="order-2 lg:order-1">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8 shadow-sm">
              <div className="mb-6">
                <div className="flex items-center mb-4">
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Today's Entry</h3>
              </div>
              
              <div className="space-y-4">
                <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                  Finally built my app.
                  <br />
                  It's happening.
                </p>
                
                <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    March 15, 2024 • 2:34 PM
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Column - Track Player */}
          <div className="order-1 lg:order-2">
            <div className="bg-gradient-to-br from-accent-mint/10 to-accent-apricot/10 rounded-2xl p-8">
              <div className="text-center">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Generated Track</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-8">Your words, transformed into music</p>
                
                {/* Album Art Placeholder */}
                <div className="w-48 h-48 mx-auto mb-6 bg-gradient-to-br from-accent-mint to-accent-apricot rounded-2xl shadow-lg flex items-center justify-center">
                  <img 
                    src="" 
                    alt="Album artwork showing abstract musical visualization with warm gradient colors representing the emotional tone of the diary entry"
                    className="w-full h-full rounded-2xl object-cover"
                  />
                </div>
                
                {/* Track Info */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Million Dollar Dream</h4>
                  <p className="text-gray-600 dark:text-gray-300">Generated from your entry</p>
                </div>
                
                {/* Waveform */}
                <div className="mb-6">
                  <img 
                    src="" 
                    alt="Audio waveform visualization with mint green accent showing the rhythm and melody pattern of the generated song"
                    className="w-full h-12 bg-gradient-to-r from-accent-mint/30 to-accent-mint/60 rounded-lg"
                  />
                </div>
                
                {/* Play Button */}
                <button
                  onClick={handleAudioToggle}
                  disabled={isLoading}
                  className="inline-flex items-center px-8 py-3 bg-accent-mint text-white font-medium rounded-full hover:bg-accent-mint/90 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : isPlaying ? (
                    <>
                      <Pause className="w-5 h-5 mr-2" />
                      Pause Track
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      Play Track
                    </>
                  )}
                </button>
                
                {/* Duration */}
                <p className="text-sm text-gray-500 mt-4">2:34</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}