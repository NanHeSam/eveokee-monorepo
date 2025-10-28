import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@backend/convex';
import ConvexQueryBoundary from '@/components/ConvexQueryBoundary';
import toast from 'react-hot-toast';

// Get all available timezones using the Intl API
const getAvailableTimezones = (): string[] => {
  try {
    // @ts-expect-error - supportedValuesOf is available in modern browsers but not in all type definitions
    return Intl.supportedValuesOf('timeZone');
  } catch {
    // Fallback to common timezones if the API is not available
    return [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Phoenix',
      'America/Anchorage',
      'Pacific/Honolulu',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Dubai',
      'Australia/Sydney',
      'Pacific/Auckland',
    ];
  }
};

// Get user's browser timezone
const getBrowserTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Renders the Profile & Settings page with user information, subscription details, and an editable Call Settings form.
 *
 * The component fetches the current user's profile and call settings, initializes form fields from the profile or browser defaults, and provides an edit flow that validates and persists call settings (including E.164 phone validation and custom cadence day selection). It also displays subscription status and usage, and uses toast notifications for success and error feedback.
 *
 * @returns The React element for the profile page.
 */
export default function Profile() {
  const profile = useQuery(api.users.getUserProfile);
  const upsertCallSettings = useMutation(api.callSettings.upsertCallSettings);
  
  const [isEditing, setIsEditing] = useState(false);
  const [phoneE164, setPhoneE164] = useState('');
  const [timezone, setTimezone] = useState('');
  const [timeOfDay, setTimeOfDay] = useState('');
  const [cadence, setCadence] = useState<'daily' | 'weekdays' | 'weekends' | 'custom'>('daily');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [active, setActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const availableTimezones = getAvailableTimezones();

  // Initialize form with current settings or browser defaults
  useEffect(() => {
    if (profile?.callSettings) {
      setPhoneE164(profile.callSettings.phoneE164);
      setTimezone(profile.callSettings.timezone);
      setTimeOfDay(profile.callSettings.timeOfDay);
      setCadence(profile.callSettings.cadence);
      setDaysOfWeek(profile.callSettings.daysOfWeek || []);
      setActive(profile.callSettings.active);
    } else {
      // Set defaults
      setTimezone(getBrowserTimezone());
      setTimeOfDay('09:00');
      setCadence('daily');
      setDaysOfWeek([]);
      setActive(false);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!phoneE164 || !timezone || !timeOfDay) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate E.164 phone format (+ followed by 1-15 digits)
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(phoneE164)) {
      toast.error('Phone number must be in E.164 format (e.g., +12025551234)');
      return;
    }

    // Validate custom cadence has at least one day selected
    if (cadence === 'custom' && daysOfWeek.length === 0) {
      toast.error('Please select at least one day for custom cadence');
      return;
    }

    setIsSaving(true);
    try {
      await upsertCallSettings({
        phoneE164,
        timezone,
        timeOfDay,
        cadence,
        daysOfWeek: cadence === 'custom' ? daysOfWeek : undefined,
        active,
      });
      toast.success('Call settings saved successfully');
      setIsEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile?.callSettings) {
      setPhoneE164(profile.callSettings.phoneE164);
      setTimezone(profile.callSettings.timezone);
      setTimeOfDay(profile.callSettings.timeOfDay);
      setCadence(profile.callSettings.cadence);
      setDaysOfWeek(profile.callSettings.daysOfWeek || []);
      setActive(profile.callSettings.active);
    }
    setIsEditing(false);
  };

  const toggleDayOfWeek = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter(d => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort());
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getSubscriptionStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'in_grace':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'canceled':
      case 'expired':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSubscriptionStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'in_grace':
        return 'In Grace Period';
      case 'canceled':
        return 'Canceled';
      case 'expired':
        return 'Expired';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const formatProductName = (productId: string) => {
    // Split by _ or - and capitalize each word
    return productId
      .split(/[_-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getCadenceDisplay = (cadenceType: string, days?: number[]) => {
    switch (cadenceType) {
      case 'daily':
        return 'Every day';
      case 'weekdays':
        return 'Monday - Friday';
      case 'weekends':
        return 'Saturday - Sunday';
      case 'custom':
        return days && days.length > 0
          ? days.map(d => DAYS_OF_WEEK[d]).join(', ')
          : 'No days selected';
      default:
        return cadenceType;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Profile & Settings
        </h1>
        
        <ConvexQueryBoundary
          queries={[{ data: profile }]}
          loadingFallback={
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading profile...</span>
            </div>
          }
        >
          {profile && (
            <div className="space-y-6">
              {/* User Information Card */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  User Information
                </h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Name</label>
                    <p className="text-gray-900">{profile.user.name || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Email</label>
                    <p className="text-gray-900">{profile.user.email || 'Not set'}</p>
                  </div>
                </div>
              </div>

              {/* Subscription Information Card */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Subscription Status
                </h2>
                {profile.subscription ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Plan</label>
                      <p className="text-gray-900 font-semibold">
                        {profile.subscription.tier === 'monthly' && 'Premium Monthly'}
                        {profile.subscription.tier === 'yearly' && 'Premium Yearly'}
                        {profile.subscription.tier === 'free' && 'Free'}
                        {!['monthly', 'yearly', 'free'].includes(profile.subscription.tier) && profile.subscription.tier.charAt(0).toUpperCase() + profile.subscription.tier.slice(1)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Product</label>
                      <p>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getSubscriptionStatusColor(profile.subscription.status)}`}>
                          {formatProductName(profile.subscription.productId)} - {getSubscriptionStatusLabel(profile.subscription.status)}
                        </span>
                      </p>
                    </div>
                    {profile.subscription.tier === 'free' && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Music Generations</label>
                        <p className="text-gray-900">
                          {profile.subscription.musicGenerationsUsed} / {profile.subscription.musicLimit}
                          <span className="text-sm text-gray-500 ml-2">
                            ({profile.subscription.remainingQuota} remaining)
                          </span>
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-gray-600">Current Period</label>
                      <p className="text-gray-900">
                        {formatDate(profile.subscription.periodStart)} - {formatDate(profile.subscription.periodEnd)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">No active subscription</p>
                )}
              </div>

              {/* Call Settings Card */}
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Call Settings
                  </h2>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Edit Settings
                    </button>
                  )}
                </div>

                {!isEditing && profile.callSettings ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Phone Number</label>
                      <p className="text-gray-900">{profile.callSettings.phoneE164}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Timezone</label>
                      <p className="text-gray-900">{profile.callSettings.timezone}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Time of Day</label>
                      <p className="text-gray-900">{profile.callSettings.timeOfDay}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Cadence</label>
                      <p className="text-gray-900">{getCadenceDisplay(profile.callSettings.cadence, profile.callSettings.daysOfWeek)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Status</label>
                      <p>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                          profile.callSettings.active
                            ? 'text-green-600 bg-green-50 border-green-200'
                            : 'text-gray-600 bg-gray-50 border-gray-200'
                        }`}>
                          {profile.callSettings.active ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    </div>
                  </div>
                ) : !isEditing ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">No call settings configured</p>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Set Up Call Settings
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="phoneE164" className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number (E.164 format) *
                      </label>
                      <input
                        id="phoneE164"
                        type="tel"
                        value={phoneE164}
                        onChange={(e) => setPhoneE164(e.target.value)}
                        placeholder="+12125551234"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">Format: +[country code][number]</p>
                    </div>

                    <div>
                      <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
                        Timezone *
                      </label>
                      <select
                        id="timezone"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select timezone...</option>
                        {availableTimezones.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Browser detected: {getBrowserTimezone()}
                      </p>
                    </div>

                    <div>
                      <label htmlFor="timeOfDay" className="block text-sm font-medium text-gray-700 mb-1">
                        Time of Day (24h format) *
                      </label>
                      <input
                        id="timeOfDay"
                        type="time"
                        value={timeOfDay}
                        onChange={(e) => setTimeOfDay(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label htmlFor="cadence" className="block text-sm font-medium text-gray-700 mb-1">
                        Cadence *
                      </label>
                      <select
                        id="cadence"
                        value={cadence}
                        onChange={(e) => setCadence(e.target.value as 'daily' | 'weekdays' | 'weekends' | 'custom')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="daily">Every day</option>
                        <option value="weekdays">Weekdays (Mon-Fri)</option>
                        <option value="weekends">Weekends (Sat-Sun)</option>
                        <option value="custom">Custom days</option>
                      </select>
                    </div>

                    {cadence === 'custom' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Days
                        </label>
                        <div className="grid grid-cols-7 gap-2">
                          {DAYS_OF_WEEK.map((day, index) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleDayOfWeek(index)}
                              className={`px-2 py-2 rounded text-sm font-medium transition-colors ${
                                daysOfWeek.includes(index)
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {day.slice(0, 3)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="active"
                        checked={active}
                        onChange={(e) => setActive(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="active" className="ml-2 block text-sm text-gray-700">
                        Enable call scheduling
                      </label>
                    </div>

                    <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                      <button
                        onClick={handleCancel}
                        disabled={isSaving}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
                      >
                        {isSaving && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        )}
                        Save Settings
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </ConvexQueryBoundary>
      </div>
    </div>
  );
}
