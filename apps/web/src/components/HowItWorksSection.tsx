import { useState, useEffect } from 'react';
import { PenTool, Music, Headphones, Loader2, Sparkles } from 'lucide-react';
import { SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@diary-vibes/backend';
import Confetti from 'react-confetti';
import { Link } from 'react-router-dom';
import DemoCard from './DemoCard';

interface Step {
  id: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  details: string;
}

const steps: Step[] = [
  {
    id: 1,
    icon: <PenTool className="w-8 h-8" />,
    title: 'Write a line',
    description: 'Capture your moment',
    details: 'Simply write down what you\'re feeling or experiencing in the moment.'
  },
  {
    id: 2,
    icon: <Music className="w-8 h-8" />,
    title: 'Tap Generate',
    description: 'We turn your words into music',
    details: 'Our AI analyzes the emotion and creates a personalized song just for you.'
  },
  {
    id: 3,
    icon: <Headphones className="w-8 h-8" />,
    title: 'Listen back',
    description: 'Relive your story as sound',
    details: 'Experience your memories through music and feel the emotions come alive.'
  }
];

interface GeneratedMusic {
  diaryId: string;
  audioUrl?: string;
  title?: string;
  status: 'pending' | 'ready' | 'failed';
  duration?: number;
  lyric?: string;
  imageUrl?: string;
}

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  avatarUrl: string;
}

const testimonials: Testimonial[] = [
  {
    quote: 'Journaling has never been so fun.',
    name: 'Olivia Chen',
    role: 'Early user',
    avatarUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
  },
  {
    quote: "It wasn't perfect — but it was mine.",
    name: 'Marcus Lee',
    role: 'Beta user',
    avatarUrl: 'https://randomuser.me/api/portraits/men/22.jpg',
  },
  {
    quote: 'You feel cool just listening to your own track.',
    name: 'Priya Patel',
    role: 'Community member',
    avatarUrl: 'https://randomuser.me/api/portraits/women/68.jpg',
  },
  {
    quote: 'It helped me capture a feeling I couldn’t put into words.',
    name: 'Daniel Park',
    role: 'Alpha tester',
    avatarUrl: 'https://randomuser.me/api/portraits/men/9.jpg',
  },
  {
    quote: 'I listen to my entry on repeat when I need a boost.',
    name: 'Maya Rodriguez',
    role: 'Early community',
    avatarUrl: 'https://randomuser.me/api/portraits/women/12.jpg',
  },
  {
    quote: 'Made journaling feel playful again — I actually look forward to it.',
    name: 'Ethan Wright',
    role: 'Pilot cohort',
    avatarUrl: 'https://randomuser.me/api/portraits/men/31.jpg',
  },
];

export default function HowItWorksSection() {
  const [diaryContent, setDiaryContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [retryDiaryId, setRetryDiaryId] = useState<string | null>(null);
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  
  const { isSignedIn, userId } = useAuth();
  
  const startMusicGeneration = useMutation(api.music.startDiaryMusicGeneration);
  const [generatedMusic, setGeneratedMusic] = useState<GeneratedMusic | null>(null);
  const storageKey = `last_generated_music_${userId ?? 'guest'}`;

  // Restore last generated music card on refresh
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      if (raw && !generatedMusic) {
        const data = JSON.parse(raw) as GeneratedMusic;
        setGeneratedMusic(data);
        if (data.status === 'pending') {
          setIsGenerating(true);
        }
      }
    } catch {
      // no-op
    }
    // We only depend on storageKey so it runs on auth changes or first mount
  }, [storageKey, generatedMusic]);

  // Persist whenever generatedMusic changes (or clear when reset)
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      if (generatedMusic) {
        localStorage.setItem(storageKey, JSON.stringify(generatedMusic));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // no-op
    }
  }, [generatedMusic, storageKey]);

  // Auto-advance testimonials every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTestimonialIndex((i) => (i + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const nextTestimonial = () => setTestimonialIndex((i) => (i + 1) % testimonials.length);
  const prevTestimonial = () => setTestimonialIndex((i) => (i - 1 + testimonials.length) % testimonials.length);
  
  // Always subscribe to playlist updates when signed in
  const shouldSubscribe = isSignedIn;
  const listPlaylistMusic = useQuery(
    api.music.listPlaylistMusic,
    shouldSubscribe ? {} : "skip"
  );

  // Timer for elapsed time during generation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating && startTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating, startTime]);

  // Check for music generation completion
  useEffect(() => {
    try {
      if (isGenerating && listPlaylistMusic && generatedMusic) {
        const music = listPlaylistMusic.find(m => m.diaryId === generatedMusic.diaryId);
        // If still pending, align timer start to the original creation time
        if (music && music.status === 'pending') {
          const created = typeof music.createdAt === 'number'
            ? music.createdAt
            : typeof music.diaryDate === 'number'
            ? music.diaryDate
            : null;
          if (created && (!startTime || startTime > created)) {
            setStartTime(created);
            setElapsedTime(Math.floor((Date.now() - created) / 1000));
          }
        }
        if (music?.status === 'ready' && music.audioUrl) {
          setIsGenerating(false);
          setGeneratedMusic({
            ...generatedMusic,
            status: 'ready',
            audioUrl: music.audioUrl,
            title: music.title,
            duration: music.duration,
            lyric: music.lyric,
            imageUrl: music.imageUrl
          });
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 5000);
        } else if (music?.status === 'failed') {
          setIsGenerating(false);
          setGeneratedMusic({ ...generatedMusic, status: 'failed' });
        }
      }
    } catch (error) {
      console.error('Error checking music generation status:', error);
      setIsGenerating(false);
      if (generatedMusic) {
        setGeneratedMusic({ ...generatedMusic, status: 'failed' });
      }
    }
  }, [listPlaylistMusic, isGenerating, generatedMusic, startTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diaryContent.trim() || isGenerating) return;

    try {
      // Reuse previous diaryId on retry to avoid creating new rows
      const payload: { content: string; diaryId?: string } = { content: diaryContent.trim() };
      if (retryDiaryId) payload.diaryId = retryDiaryId;
      const result = await startMusicGeneration(payload);

      // Respect API fields: success and reason
      if (!result?.success) {
        // Keep not generating; show error toast
        setIsGenerating(false);
        setStartTime(null);
        setElapsedTime(0);
        // Record returned diaryId for next attempt to reuse
        if (result?.diaryId) {
          setRetryDiaryId(String(result.diaryId));
        }
        setToast({
          message: result?.reason || 'Failed to start music generation',
          type: 'error',
        });
        // Auto-dismiss toast after 5s
        setTimeout(() => setToast(null), 5000);
        return;
      }

      // Successful start — mark generating and clear retry id
      setIsGenerating(true);
      setRetryDiaryId(null);
      // Only start generation tracking when API call succeeds
      setStartTime(Date.now());
      setElapsedTime(0);

      // Track the diary by its ID returned from the API
      setGeneratedMusic({
        diaryId: result.diaryId,
        status: 'pending'
      });
      
    } catch (error) {
      console.error('Failed to start music generation:', error);
      setIsGenerating(false);
      setStartTime(null);
      setElapsedTime(0);
      setToast({
        message: 'Something went wrong. Please try again.',
        type: 'error',
      });
      setTimeout(() => setToast(null), 5000);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimingMessage = () => {
    if (elapsedTime < 30) {
      return "Analyzing your emotions and crafting the perfect melody...";
    } else if (elapsedTime < 60) {
      return "Adding harmonies and building the musical structure...";
    } else if (elapsedTime < 90) {
      return "Fine-tuning the composition to match your mood...";
    } else {
      return "Putting the finishing touches on your personalized song...";
    }
  };

  const formatDuration = (d?: number) => {
    if (!d || d < 0) return '0:00';
    const mins = Math.floor(d / 60);
    const secs = Math.floor(d % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectTrack = (music: { diaryId: string; status?: string; createdAt?: number; diaryDate?: number; audioUrl?: string; title?: string; duration?: number; lyric?: string; imageUrl?: string }) => {
    if (!music) return;
    setShowConfetti(false);

    const nextStatus: 'pending' | 'ready' | 'failed' = music.status === 'ready' ? 'ready' : music.status === 'failed' ? 'failed' : 'pending';

    if (nextStatus === 'pending') {
      // Show the loading screen for pending tracks
      setIsGenerating(true);
      const created = typeof music.createdAt === 'number'
        ? music.createdAt
        : typeof music.diaryDate === 'number'
        ? music.diaryDate
        : null;
      const start = created ?? Date.now();
      setStartTime(start);
      setElapsedTime(Math.floor((Date.now() - start) / 1000));
    } else {
      // Ready or failed should not show loading
      setIsGenerating(false);
      setStartTime(null);
      setElapsedTime(0);
    }

    setGeneratedMusic({
      diaryId: music.diaryId,
      status: nextStatus,
      audioUrl: music.audioUrl,
      title: music.title,
      duration: music.duration,
      lyric: music.lyric,
      imageUrl: music.imageUrl
    });
  };

  return (
    <section id="how-it-works" className="py-20 bg-white dark:bg-gray-900 relative">
      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
        />
      )}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            <SignedOut>How this new kind of journaling works</SignedOut>
            <SignedIn>Try it yourself!</SignedIn>
          </h2>
          <SignedIn>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Write a few sentences about your day and watch as we transform your words into a personalized song.
            </p>
          </SignedIn>
        </div>

        {/* Alpha Credits Note (visible to everyone) */}
        <div className="max-w-3xl mx-auto mb-10">
          <div className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 text-gray-800 dark:text-gray-200">
            <Sparkles className="w-5 h-5 text-accent-mint mt-0.5" />
            <p className="text-sm">
              <span className="font-semibold">Alpha note:</span> Total credits are <span className="font-semibold">3</span> during the alpha period.
            </p>
          </div>
        </div>

        <SignedOut>
          {/* Original Static Content for Non-Authenticated Users */}
          <div className="grid md:grid-cols-3 gap-12 mb-16">
            {steps.map((step) => (
              <div key={step.id} className="text-center relative">
                {/* Step Content */}
                <div className="relative z-10">
                  {/* Icon */}
                  <div className="w-16 h-16 bg-accent-mint rounded-full flex items-center justify-center text-white mx-auto mb-6 shadow-lg">
                    {step.icon}
                  </div>

                  
                  {/* Title */}
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {step.title}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-accent-mint font-medium mb-4">
                    {step.description}
                  </p>
                  
                  {/* Details */}
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {step.details}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Call to Action for Non-Authenticated Users */}
          <div className="text-center mb-16">
            <div className="bg-gradient-to-r from-accent-mint to-accent-apricot dark:from-gray-700 dark:to-gray-600 rounded-2xl p-8 text-white">
              <h3 className="text-3xl sm:text-4xl font-bold mb-4">Try it yourself!</h3>
              <p className="text-lg mb-6 opacity-90">Sign up now to try the interactive demo and create your first musical diary entry!</p>
              <Link
                to="/sign-up"
                className="inline-flex items-center px-8 py-3 bg-accent-mint text-white font-semibold rounded-lg hover:bg-accent-mint/90 transition-colors"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Interactive Demo for Authenticated Users */}
          <div className="max-w-4xl mx-auto">
            {toast && (
              <div
                role="alert"
                className={`mb-4 px-4 py-3 rounded-lg shadow-sm border ${
                  toast.type === 'error'
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                    : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{toast.message}</span>
                  <button
                    onClick={() => setToast(null)}
                    className="ml-4 text-xs underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            {!generatedMusic ? (
              /* Diary Entry Form */
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-3xl p-8 mb-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="diary-content" className="block text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      How was your day? Share a few sentences...
                    </label>
                    <textarea
                      id="diary-content"
                      value={diaryContent}
                      onChange={(e) => setDiaryContent(e.target.value)}
                      placeholder="Today I felt grateful for the small moments. The morning coffee tasted perfect, and I had a meaningful conversation with a friend..."
                      className="w-full h-32 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-accent-mint focus:border-transparent resize-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-800"
                      disabled={isGenerating}
                    />
                  </div>
                  
                  <div className="text-center">
                    <button
                      type="submit"
                      disabled={!diaryContent.trim() || isGenerating}
                      className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-accent-mint to-accent-apricot text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Generating Music...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-2" />
                          Generate My Song
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* Music Generation Status */
              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 mb-8 border border-gray-100 dark:border-gray-700">
                {isGenerating ? (
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gradient-to-r from-accent-mint to-accent-apricot rounded-full flex items-center justify-center mx-auto mb-6">
                      <Loader2 className="w-10 h-10 text-white animate-spin" />
                    </div>
                    
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                      Creating your musical masterpiece...
                    </h3>
                    
                    <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                      {getTimingMessage()}
                    </p>
                    
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2 mb-4 max-w-md mx-auto">
                      <div 
                        className="bg-gradient-to-r from-accent-mint to-accent-apricot h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min((elapsedTime / 120) * 100, 95)}%` }}
                      ></div>
                    </div>
                    
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Elapsed time: {formatTime(elapsedTime)} • Expected: 30s - 2min
                    </p>
                  </div>
                ) : generatedMusic.status === 'ready' ? (
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
                      🎉 Your song is ready!
                    </h3>
                    
                    {/* Demo Card Layout */}
                    <div className="max-w-md mx-auto">
                      <DemoCard
                        lyric={generatedMusic.lyric || ''}
                        title={generatedMusic.title || 'Your Personalized Song'}
                        date={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        imageUrl={generatedMusic.imageUrl}
                        audioId={generatedMusic.diaryId}
                        audioUrl={generatedMusic.audioUrl || ''}
                        duration={generatedMusic.duration ? `${Math.floor(generatedMusic.duration / 60)}:${Math.floor(generatedMusic.duration % 60).toString().padStart(2, '0')}` : '0:00'}
                      />
                    </div>
                    
                    <div className="mt-8">
                      <button
                        onClick={() => {
                          setGeneratedMusic(null);
                          setDiaryContent('');
                          setElapsedTime(0);
                          setStartTime(null);
                        }}
                        className="inline-flex items-center px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        Try Another Entry
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Music className="w-10 h-10 text-red-500 dark:text-red-400" />
                    </div>
                    
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                      Something went wrong
                    </h3>
                    
                    <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
                      We couldn't generate your song this time. Please try again.
                    </p>
                    
                    <button
                      onClick={() => {
                        setGeneratedMusic(null);
                        setDiaryContent('');
                        setElapsedTime(0);
                        setStartTime(null);
                      }}
                      className="inline-flex items-center px-6 py-3 bg-accent-mint text-white font-medium rounded-lg hover:bg-accent-mint/90 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Playlist List for Authenticated Users */}
          {Array.isArray(listPlaylistMusic) && listPlaylistMusic.length > 0 && (
            <div className="max-w-4xl mx-auto mt-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Your Playlist</h3>
              <ul className="rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
                {listPlaylistMusic.map((m) => (
                  <li
                    key={String(m._id)}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => handleSelectTrack(m)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 dark:text-white font-medium truncate">{m.title || 'Untitled Track'}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{m.lyric?.split('\n')[0] || ''}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{formatDuration(m.duration)}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${m.status === 'ready' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : m.status === 'failed' ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'}`}>{m.status}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Tap a song to load it above.</p>
            </div>
          )}
        </SignedIn>

        {/* Testimonials Carousel (shown for both authenticated and non-authenticated users) */}
        <div className="relative mt-24">
          <div className="overflow-hidden rounded-2xl">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${testimonialIndex * 100}%)` }}
            >
              {testimonials.map((t) => (
                <div key={t.name} className="min-w-full px-2">
                  <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl max-w-3xl mx-auto">
                    <blockquote className="text-gray-900 dark:text-white text-xl leading-relaxed mb-6 text-center">
                      <span className="text-3xl text-accent-mint align-top mr-1">"</span>
                      {t.quote}
                      <span className="text-3xl text-accent-mint align-top ml-1">"</span>
                    </blockquote>
                    <div className="flex items-center justify-center gap-3">
                      <img
                        src={t.avatarUrl}
                        alt={`${t.name} profile photo`}
                        className="w-12 h-12 rounded-full object-cover shadow-sm"
                      />
                      <div className="text-left">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t.role}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Controls */}
          <button
            aria-label="Previous testimonial"
            onClick={prevTestimonial}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 rounded-full shadow p-2"
          >
            ‹
          </button>
          <button
            aria-label="Next testimonial"
            onClick={nextTestimonial}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 rounded-full shadow p-2"
          >
            ›
          </button>

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-4">
            {testimonials.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to testimonial ${i + 1}`}
                onClick={() => setTestimonialIndex(i)}
                className={`h-2 w-2 rounded-full ${i === testimonialIndex ? 'bg-accent-mint' : 'bg-gray-300'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
