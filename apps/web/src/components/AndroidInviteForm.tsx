import { useState } from 'react';
import { useMutation } from 'convex/react';
import { usePostHog } from 'posthog-js/react';
import { api } from '@backend/convex';
import { isValidEmail } from '@/lib/utils';
import { CheckCircle } from 'lucide-react';

interface AndroidInviteFormProps {
  source: 'hero' | 'footer' | 'finalCTA';
  className?: string;
}

export default function AndroidInviteForm({ source, className = '' }: AndroidInviteFormProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const posthog = usePostHog();

  const addEmailNotification = useMutation(api.emailNotify.addEmailNotification);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !isValidEmail(email)) {
      setError('Please enter a valid email');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await addEmailNotification({
        email: email.trim(),
        isAndroidInvite: true,
        source,
      });
      
      setIsSuccess(true);
      setEmail('');
      
      const domain = email.trim().split('@')[1] ?? '';
      posthog?.capture('android_invite_requested', {
        source,
        email_domain: domain,
      });
    } catch (err) {
      console.error('Failed to submit Android invite request:', err);
      setError('Something went wrong. Please try again.');
      posthog?.capture('android_invite_failed', {
        source,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className={`flex items-center gap-2 text-sm text-green-600 dark:text-green-400 ${className}`}>
        <CheckCircle className="w-4 h-4" />
        <span>Request received! We'll send you an invite soon.</span>
      </div>
    );
  }

  // Use compact sizing for footer, regular for other sources
  const isCompact = source === 'footer';
  
  return (
    <form onSubmit={handleSubmit} className={`flex flex-col sm:flex-row gap-2 ${className}`}>
      <div className="flex-1">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Enter your Google Play email"
          className={`w-full ${
            isCompact 
              ? 'px-2 py-1.5 text-xs rounded-md' 
              : 'px-3 py-2 text-sm rounded-lg'
          } border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-accent-mint focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400`}
          disabled={isLoading}
        />
        {error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={isLoading || !email || !isValidEmail(email)}
        className={`${
          isCompact 
            ? 'px-3 py-1.5 text-xs rounded-md' 
            : 'px-4 py-2 text-sm rounded-lg'
        } font-medium bg-accent-mint text-white hover:bg-accent-mint/90 focus:outline-none focus:ring-2 focus:ring-accent-mint focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap`}
      >
        {isLoading ? 'Sending...' : 'Request Invite'}
      </button>
    </form>
  );
}
