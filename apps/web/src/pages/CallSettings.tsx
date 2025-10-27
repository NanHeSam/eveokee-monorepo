import { useState, useEffect, FormEvent } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@backend/convex';

const TIMEZONES = [
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
];

const CADENCE_OPTIONS = [
  { value: 'daily', label: 'Every Day' },
  { value: 'weekdays', label: 'Weekdays (Mon-Fri)' },
  { value: 'weekends', label: 'Weekends (Sat-Sun)' },
];

export default function CallSettings() {
  const callSettings = useQuery(api.callSettings.getCallSettings);
  const upsertCallSettings = useMutation(api.callSettings.upsertCallSettings);
  const toggleCallSettings = useMutation(api.callSettings.toggleCallSettings);
  const deleteCallSettings = useMutation(api.callSettings.deleteCallSettings);
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [timeOfDay, setTimeOfDay] = useState('09:00');
  const [cadence, setCadence] = useState<'daily' | 'weekdays' | 'weekends'>('daily');
  const [active, setActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  useEffect(() => {
    if (callSettings) {
      setPhoneNumber(callSettings.phoneE164);
      setTimezone(callSettings.timezone);
      setTimeOfDay(callSettings.timeOfDay);
      setCadence(callSettings.cadence as 'daily' | 'weekdays' | 'weekends');
      setActive(callSettings.active);
    }
  }, [callSettings]);
  
  const validatePhoneNumber = (phone: string): boolean => {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone);
  };
  
  const validateTimeOfDay = (time: string): boolean => {
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    return timeRegex.test(time);
  };
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!validatePhoneNumber(phoneNumber)) {
      setError('Please enter a valid phone number in E.164 format (e.g., +12125551234)');
      return;
    }
    
    if (!validateTimeOfDay(timeOfDay)) {
      setError('Please enter time in HH:MM format (24-hour, e.g., 09:00)');
      return;
    }
    
    setIsSaving(true);
    try {
      await upsertCallSettings({
        phoneE164: phoneNumber,
        timezone,
        timeOfDay,
        cadence,
        active,
      });
      setSuccess('Call settings saved successfully');
    } catch (err) {
      console.error('Failed to save call settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save call settings');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleToggleActive = async () => {
    const newActive = !active;
    setActive(newActive);
    if (callSettings) {
      try {
        await toggleCallSettings({ active: newActive });
      } catch (err) {
        console.error('Failed to toggle call settings:', err);
        setActive(!newActive);
      }
    }
  };
  
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete your call settings? This will cancel all pending calls.')) {
      return;
    }
    
    try {
      await deleteCallSettings();
      setPhoneNumber('');
      setTimezone('America/New_York');
      setTimeOfDay('09:00');
      setCadence('daily');
      setActive(false);
      setSuccess('Call settings deleted successfully');
    } catch (err) {
      console.error('Failed to delete call settings:', err);
      setError('Failed to delete call settings');
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Daily Call Settings
            </h1>
            <p className="text-gray-600 mb-8">
              Configure your daily call schedule. You'll receive a call at your specified time based on your cadence.
            </p>
            
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            
            {success && (
              <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
                {success}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Active Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="text-lg font-semibold text-gray-900">
                    Active
                  </label>
                  <p className="text-sm text-gray-600 mt-1">
                    Enable or disable daily calls
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleActive}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    active ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              {/* Phone Number */}
              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-semibold text-gray-900 mb-2">
                  Phone Number
                </label>
                <p className="text-sm text-gray-600 mb-2">
                  Enter your phone number in E.164 format (e.g., +12125551234)
                </p>
                <input
                  type="tel"
                  id="phoneNumber"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+12125551234"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              {/* Timezone */}
              <div>
                <label htmlFor="timezone" className="block text-sm font-semibold text-gray-900 mb-2">
                  Timezone
                </label>
                <select
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Time of Day */}
              <div>
                <label htmlFor="timeOfDay" className="block text-sm font-semibold text-gray-900 mb-2">
                  Time of Day
                </label>
                <p className="text-sm text-gray-600 mb-2">
                  Enter time in 24-hour format (HH:MM, e.g., 09:00 for 9 AM)
                </p>
                <input
                  type="text"
                  id="timeOfDay"
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(e.target.value)}
                  placeholder="09:00"
                  pattern="([0-1][0-9]|2[0-3]):([0-5][0-9])"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              {/* Cadence */}
              <div>
                <label htmlFor="cadence" className="block text-sm font-semibold text-gray-900 mb-2">
                  Cadence
                </label>
                <select
                  id="cadence"
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value as 'daily' | 'weekdays' | 'weekends')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {CADENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Save Button */}
              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
              
              {/* Delete Button */}
              {callSettings && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-full bg-red-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  Delete Settings
                </button>
              )}
            </form>
            
            {/* Consent Notice */}
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-gray-700">
                By enabling daily calls, you consent to receiving automated phone calls at your specified time. 
                Calls may be recorded for quality and training purposes. You can disable calls at any time by 
                toggling the Active switch above.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
