import { FaApple } from 'react-icons/fa';

export default function IOSAppStoreButton() {
  return (
    <a
      href="https://apps.apple.com/us/app/eveokee/id6754190123"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 bg-accent-mint text-white rounded-full text-sm font-medium hover:bg-accent-mint/90 dark:bg-accent-mint dark:hover:bg-accent-mint/90 transition-colors"
    >
      <FaApple className="w-4 h-4" />
      iOS App Store
    </a>
  );
}
