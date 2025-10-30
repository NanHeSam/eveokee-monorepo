export function isAndroidDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as Window & { opera?: string }).opera || '';
  return /android/i.test(userAgent);
}

export function getAndroidBetaLink(): string {
  if (isAndroidDevice()) {
    return 'https://play.google.com/store/apps/details?id=com.eveokee.app';
  }
  return 'https://play.google.com/apps/testing/com.eveokee.app';
}
