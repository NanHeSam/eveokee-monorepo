import { Play, Music, Pause, Book, Settings } from 'lucide-react';
import { usePostHog } from 'posthog-js/react';
import { useAudio } from '../contexts/AudioContext';
import { getAndroidBetaLink } from '../utils/deviceUtils';
import AndroidInviteForm from './AndroidInviteForm';
import IOSAppStoreButton from './IOSAppStoreButton';
import { motion, useReducedMotion, useInView, useAnimation } from 'framer-motion';
import { useEffect, useRef } from 'react';

interface HeroSectionProps {
  onHearDemo?: () => void;
}

export default function HeroSection({ onHearDemo }: HeroSectionProps) {
  const audioManager = useAudio();
  const posthog = usePostHog();
  const androidBetaLink = getAndroidBetaLink();
  const shouldReduceMotion = useReducedMotion();
  
  // Viewport visibility tracking for animations
  const phoneMockupRef = useRef(null);
  const isInView = useInView(phoneMockupRef, { once: false, margin: "-100px" });
  
  const phoneAnimation = useAnimation();
  const floatingAnimation1 = useAnimation();
  const floatingAnimation2 = useAnimation();
  
  // Control phone mockup animation based on viewport visibility
  useEffect(() => {
    if (shouldReduceMotion) {
      phoneAnimation.set({ y: 0 });
      return;
    }
    
    if (isInView) {
      phoneAnimation.start({
        y: [0, -15, 0],
        transition: {
          duration: 8, // Increased from 6 to reduce workload
          repeat: Infinity,
          ease: "easeInOut"
        }
      });
    } else {
      phoneAnimation.stop();
      phoneAnimation.set({ y: 0 });
    }
  }, [isInView, shouldReduceMotion, phoneAnimation]);
  
  // Control floating elements animations based on viewport visibility
  useEffect(() => {
    if (shouldReduceMotion) {
      floatingAnimation1.set({ scale: 1 });
      floatingAnimation2.set({ scale: 1 });
      return;
    }
    
    if (isInView) {
      floatingAnimation1.start({
        scale: [1, 1.2, 1],
        transition: {
          duration: 3, // Increased from 2 to reduce workload
          repeat: Infinity,
          ease: "easeInOut"
        }
      });
      floatingAnimation2.start({
        scale: [1, 1.2, 1],
        transition: {
          duration: 3, // Increased from 2 to reduce workload
          repeat: Infinity,
          delay: 1,
          ease: "easeInOut"
        }
      });
    } else {
      floatingAnimation1.stop();
      floatingAnimation2.stop();
      floatingAnimation1.set({ scale: 1 });
      floatingAnimation2.set({ scale: 1 });
    }
  }, [isInView, shouldReduceMotion, floatingAnimation1, floatingAnimation2]);
  
  const demoAudioUrl = 'https://cdn1.suno.ai/b28aad1b-2d89-44f9-9f06-0e4fe429f98e.mp3';
  const heroAudioId = 'hero-demo';
  
  const handleAudioToggle = async () => {
    audioManager.setCurrentTrack({
      id: heroAudioId,
      title: 'Eveokee Demo',
      imageUrl: undefined,
      duration: undefined,
      diaryContent: 'A demo of how your diary entries can become music',
      audioUrl: demoAudioUrl,
    });
    await audioManager.toggleAudio(heroAudioId, demoAudioUrl);
    
    // Call the original onHearDemo if provided
    if (onHearDemo) {
      onHearDemo();
    }
    // Capture demo audio toggle
    const event = audioManager.isPlaying ? 'hero_demo_pause' : 'hero_demo_play';
    posthog?.capture(event, {
      audio_id: heroAudioId,
    });
  };
  
  const isCurrentAudio = audioManager.isCurrentAudio(heroAudioId);
  const isPlaying = isCurrentAudio && audioManager.isPlaying;
  const isLoading = isCurrentAudio && audioManager.isLoading;
  return (
    <section className="py-20 lg:py-28 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text Content */}
          <motion.div 
            initial={{ opacity: shouldReduceMotion ? 1 : 0, x: shouldReduceMotion ? 0 : -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={shouldReduceMotion ? {} : { duration: 0.8, ease: "easeOut" }}
            className="text-center lg:text-left"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight">
              Turn your diary
              <br />
              <motion.span 
                initial={{ opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={shouldReduceMotion ? {} : { delay: 0.5, duration: 0.8 }}
                className="text-accent-mint inline-block"
              >
                into sound
              </motion.span>
            </h1>
            
            <motion.p 
              initial={{ opacity: shouldReduceMotion ? 1 : 0 }}
              animate={{ opacity: 1 }}
              transition={shouldReduceMotion ? {} : { delay: 0.8, duration: 0.8 }}
              className="mt-6 text-xl text-gray-600 dark:text-gray-300 leading-relaxed"
            >
              A new way of journaling — where your words become music.
            </motion.p>
            
            {/* CTA Buttons */}
            <motion.div 
              initial={{ opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={shouldReduceMotion ? {} : { delay: 1.0, duration: 0.5 }}
              className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <motion.button
                whileHover={shouldReduceMotion ? {} : { scale: 1.05 }}
                whileTap={shouldReduceMotion ? {} : { scale: 0.95 }}
                onClick={handleAudioToggle}
                disabled={isLoading}
                className={`inline-flex items-center px-6 py-3 font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 ${
                  isLoading 
                    ? 'bg-gray-400 text-white cursor-not-allowed' 
                    : isPlaying
                    ? 'bg-accent-apricot text-white hover:bg-accent-apricot/90'
                    : 'bg-accent-mint text-white hover:bg-accent-mint/90'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Loading...
                  </>
                ) : isPlaying ? (
                  <>
                    <Pause className="w-5 h-5 mr-2" />
                    Playing demo
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Hear the demo
                  </>
                )}
              </motion.button>
              
              {audioManager.error && (
                <div className="mt-2 text-sm text-red-600 text-center lg:text-left">
                  {audioManager.error}
                </div>
              )}
              

            </motion.div>
            
            {/* App Beta Links */}
            <motion.div 
              initial={{ opacity: shouldReduceMotion ? 1 : 0 }}
              animate={{ opacity: 1 }}
              transition={shouldReduceMotion ? {} : { delay: 1.2, duration: 0.8 }}
              className="mt-6 space-y-4"
            >
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <IOSAppStoreButton />
                <a
                  href={androidBetaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-orange-100 text-orange-600 rounded-full text-sm font-medium hover:bg-orange-200/60 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50 transition-colors"
                >
                  📱 Android Beta
                </a>
              </div>
              <div className="text-center lg:text-left">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Internal test — enter your Google Play email to request access
                </p>
                <AndroidInviteForm source="hero" />
              </div>
            </motion.div>
          </motion.div>
          
          {/* Right Column - Phone Mockup */}
          <motion.div 
            initial={{ opacity: shouldReduceMotion ? 1 : 0, x: shouldReduceMotion ? 0 : 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={shouldReduceMotion ? {} : { duration: 1, ease: "easeOut" }}
            className="flex justify-center lg:justify-end"
          >
            <motion.div 
              ref={phoneMockupRef}
              animate={phoneAnimation}
              className="relative"
            >
              {/* Phone Frame */}
              <div className="w-80 h-[600px] bg-gray-900 dark:bg-gray-700 rounded-[3rem] p-2 shadow-2xl dark:shadow-gray-900/50 border border-gray-800 dark:border-gray-600">
                <div className="w-full h-full bg-white dark:bg-gray-900 rounded-[2.5rem] overflow-hidden relative">
                  {/* Phone Screen Content */}
                  <div className="h-full flex flex-col bg-white dark:bg-gray-900">
                    {/* Status Bar */}
                    <div className="flex justify-between items-center px-6 pt-4 pb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">22:34</span>
                      <div className="w-16 h-6 bg-black dark:bg-gray-950 rounded-full"></div>
                      <div className="flex items-center space-x-1">
                        <div className="flex space-x-1">
                          <div className="w-1 h-1 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
                          <div className="w-1 h-1 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
                        </div>
                        <div className="w-4 h-2 bg-gray-400 dark:bg-gray-500 rounded-sm"></div>
                        <div className="w-6 h-3 bg-green-500 rounded-sm relative">
                          <div className="absolute right-0 top-0 w-1 h-full bg-white dark:bg-gray-900 rounded-r-sm"></div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Header */}
                    <div className="text-center px-6 py-4">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Diaries</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">A creative studio where words become melodies.</p>
                    </div>
                    
                    {/* List/Calendar Toggle */}
                    <div className="flex justify-center space-x-8 px-6 pb-4">
                      <button className="text-sm font-medium text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white pb-1">List</button>
                      <button className="text-sm font-medium text-gray-400 dark:text-gray-500">Calendar</button>
                    </div>
                    
                    {/* Content Area */}
                    <div className="flex-1 px-6 overflow-y-auto scrollbar-hide">
                      {/* October 2025 */}
                      <div className="mb-4">
                        <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">OCTOBER 2025</h3>
                        
                        {/* Diary Entries */}
                        <div className="space-y-4">
                          {/* Entry 1 */}
                          <motion.div 
                            initial={{ opacity: shouldReduceMotion ? 1 : 0, x: shouldReduceMotion ? 0 : -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={shouldReduceMotion ? {} : { delay: 1.5, duration: 0.5 }}
                            className="flex items-start space-x-3"
                          >
                            <div className="text-center">
                              <div className="text-xs text-gray-400 dark:text-gray-500 uppercase">FRI</div>
                              <div className="text-2xl font-light text-gray-900 dark:text-white">3</div>
                            </div>
                            <div className="flex-1">
                              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">14:37</div>
                              <p className="text-sm text-gray-700 dark:text-gray-300">I had a great time with my family today. We went to the park and played soccer. It was a fun day.</p>
                            </div>
                            <Music className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-1" />
                          </motion.div>
                          
                          {/* Entry 2 */}
                          <motion.div 
                            initial={{ opacity: shouldReduceMotion ? 1 : 0, x: shouldReduceMotion ? 0 : -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={shouldReduceMotion ? {} : { delay: 1.7, duration: 0.5 }}
                            className="flex items-start space-x-3"
                          >
                            <div className="text-center">
                              <div className="text-xs text-gray-400 dark:text-gray-500 uppercase">THU</div>
                              <div className="text-2xl font-light text-gray-900 dark:text-white">2</div>
                            </div>
                            <div className="flex-1">
                              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">21:07</div>
                              <p className="text-sm text-gray-700 dark:text-gray-300">I finally built my app today and put it on my iOS. It looks great. I'm so excited and want to share it to the world.</p>
                            </div>
                            <Music className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-1" />
                          </motion.div>
                          
                          {/* Entry 3 */}
                          <motion.div 
                            initial={{ opacity: shouldReduceMotion ? 1 : 0, x: shouldReduceMotion ? 0 : -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={shouldReduceMotion ? {} : { delay: 1.9, duration: 0.5 }}
                            className="flex items-start space-x-3"
                          >
                            <div className="text-center">
                              <div className="text-xs text-gray-400 dark:text-gray-500 uppercase">WED</div>
                              <div className="text-2xl font-light text-gray-900 dark:text-white">1</div>
                            </div>
                            <div className="flex-1">
                              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">11:12</div>
                              <p className="text-sm text-gray-700 dark:text-gray-300">I love my pizza</p>
                            </div>
                            <Music className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-1" />
                          </motion.div>
                        </div>
                      </div>
                      
                      {/* September 2025 */}
                      <div className="mb-4">
                        <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">SEPTEMBER 2025</h3>
                        <div className="flex items-start space-x-3">
                          <div className="text-center">
                            <div className="text-xs text-gray-400 dark:text-gray-500 uppercase">TUE</div>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-700 dark:text-gray-300">hakuna matata!!! this is my first diary</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Music Player */}
                    <motion.div 
                      initial={{ y: shouldReduceMotion ? 0 : 100 }}
                      animate={{ y: 0 }}
                      transition={shouldReduceMotion ? {} : { delay: 2.2, type: "spring", stiffness: 100 }}
                      className="px-6 py-3 border-t border-gray-100 dark:border-gray-700"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-yellow-400 rounded flex items-center justify-center">
                          <span className="text-xs">🏆</span>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">Slice of Heaven</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">October 1st, 2025</div>
                          <div className="flex items-center mt-1">
                            <div className="text-xs text-gray-400 dark:text-gray-500">0:00</div>
                            <div className="flex-1 mx-2 h-1 bg-gray-200 dark:bg-gray-700 rounded">
                              <div className="w-1/4 h-full bg-accent-mint rounded"></div>
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500">1:58</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Pause className="w-4 h-4 text-accent-mint" />
                          <button className="w-6 h-6 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center">
                            <span className="text-xs text-gray-600 dark:text-gray-400">×</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                    
                    {/* Bottom Navigation */}
                    <div className="flex justify-around py-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex flex-col items-center">
                        <Book className="w-5 h-5 text-accent-mint" />
                        <span className="text-xs text-accent-mint mt-1">Diary</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <Music className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                        <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">Playlist</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <Settings className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                        <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">Settings</span>
                      </div>
                    </div>
                    
                    {/* Home Indicator */}
                    <div className="flex justify-center pb-2">
                      <div className="w-32 h-1 bg-black dark:bg-white rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating Elements */}
              <motion.div 
                animate={floatingAnimation1}
                className="absolute -top-4 -right-4 w-8 h-8 bg-accent-apricot rounded-full"
              ></motion.div>
              <motion.div 
                animate={floatingAnimation2}
                className="absolute -bottom-4 -left-4 w-6 h-6 bg-accent-mint rounded-full"
              ></motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

