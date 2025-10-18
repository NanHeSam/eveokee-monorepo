import { useState } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useMutation } from 'convex/react';
import { api } from '@backend/convex';
import { isValidEmail } from '@/lib/utils';
import { ArrowRight, CheckCircle } from 'lucide-react';

export default function FinalCTASection() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const posthog = usePostHog();

  const addEmailNotification = useMutation(api.emailNotify.addEmailNotification);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !isValidEmail(email)) {
      setError('Please enter a valid email (domain must include a dot).');
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      await addEmailNotification({ email: email.trim() });
      setIsSubmitted(true);
      // Capture successful email notify subscription
      const domain = email.trim().split('@')[1] ?? '';
      posthog?.capture('email_notify_subscribed', {
        email_domain: domain,
      });
    } catch (err) {
      console.error('Failed to submit email:', err);
      setError('Something went wrong. Please try again.');
      // Capture failure case for diagnostics
      posthog?.capture('email_notify_failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <section className="py-20 bg-gradient-to-br from-accent-mint to-accent-apricot dark:from-gray-800 dark:to-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 shadow-2xl">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Welcome to Eveokee!
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              Thank you for signing up! We're excited to have you on this journey of turning words into music.
            </p>
            <p className="text-gray-500 dark:text-gray-400">
              Keep an eye on your inbox for updates and app launch notifications.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-gradient-to-br from-accent-mint to-accent-apricot dark:from-gray-800 dark:to-gray-700">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 shadow-2xl">
          {/* Header */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Start your new journaling journey
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Sign up today to be notified when Eveokee launches and start turning your words into music.
          </p>
          
          {/* Email Signup Form */}
          <form onSubmit={handleSubmit} className="max-w-md mx-auto mb-8">
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter your email address"
                className="flex-1 px-6 py-4 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-accent-mint focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-700"
                required
              />
              <button
                type="submit"
                disabled={isLoading || !email || !isValidEmail(email)}
                className="px-8 py-4 bg-accent-mint text-white rounded-full font-semibold hover:bg-accent-mint/90 focus:outline-none focus:ring-2 focus:ring-accent-mint focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    Get notified
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
            {error && (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            )}
          </form>
          
          {/* Benefits */}
          <div className="grid sm:grid-cols-3 gap-6 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span>Launch notifications</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span>Updates & news</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span>No spam, ever</span>
            </div>
          </div>
          
          {/* App Coming Soon Badge */}
          <div className="mt-8">
            <div className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-600 dark:text-gray-300">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              iOS/Android app coming soon
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
