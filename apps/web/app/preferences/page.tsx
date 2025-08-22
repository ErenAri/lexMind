'use client';

import AuthWrapper from '@/components/AuthWrapper';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Palette,
  Globe,
  Zap,
  Save,
  RotateCcw,
  Monitor,
  Sun,
  Moon
} from 'lucide-react';
import { useState } from 'react';

export default function PreferencesPage() {
  const [preferences, setPreferences] = useState({
    theme: 'light',
    language: 'en',
    timezone: 'UTC',
    autoSave: true,
    compactMode: false,
    animations: true,
    autoRefresh: 30,
    defaultView: 'dashboard',
    resultsPerPage: 10,
    enableKeyboardShortcuts: true
  });

  const [isDirty, setIsDirty] = useState(false);

  const updatePreference = (key: string, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const savePreferences = async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsDirty(false);
  };

  const resetPreferences = () => {
    setPreferences({
      theme: 'light',
      language: 'en',
      timezone: 'UTC',
      autoSave: true,
      compactMode: false,
      animations: true,
      autoRefresh: 30,
      defaultView: 'dashboard',
      resultsPerPage: 10,
      enableKeyboardShortcuts: true
    });
    setIsDirty(true);
  };

  return (
    <AuthWrapper>
      <DashboardLayout
        title="Preferences"
        subtitle="Customize your LexMind experience"
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={resetPreferences}
              className="btn btn-outline flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Defaults
            </button>
            <button
              onClick={savePreferences}
              disabled={!isDirty}
              className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Appearance */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <Palette className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-secondary-900">Appearance</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-3">
                  Theme
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => updatePreference('theme', 'light')}
                    className={`p-3 border-2 rounded-lg flex flex-col items-center gap-2 transition-colors ${
                      preferences.theme === 'light'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-secondary-200 hover:border-secondary-300'
                    }`}
                  >
                    <Sun className="h-5 w-5" />
                    <span className="text-sm font-medium">Light</span>
                  </button>
                  <button
                    onClick={() => updatePreference('theme', 'dark')}
                    className={`p-3 border-2 rounded-lg flex flex-col items-center gap-2 transition-colors ${
                      preferences.theme === 'dark'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-secondary-200 hover:border-secondary-300'
                    }`}
                  >
                    <Moon className="h-5 w-5" />
                    <span className="text-sm font-medium">Dark</span>
                  </button>
                  <button
                    onClick={() => updatePreference('theme', 'system')}
                    className={`p-3 border-2 rounded-lg flex flex-col items-center gap-2 transition-colors ${
                      preferences.theme === 'system'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-secondary-200 hover:border-secondary-300'
                    }`}
                  >
                    <Monitor className="h-5 w-5" />
                    <span className="text-sm font-medium">System</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Layout Density
                </label>
                <select
                  value={preferences.compactMode ? 'compact' : 'comfortable'}
                  onChange={(e) => updatePreference('compactMode', e.target.value === 'compact')}
                  className="input w-full"
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
                <p className="text-xs text-secondary-500 mt-1">
                  Comfortable layout provides more spacing
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div>
                <h4 className="font-medium text-secondary-900">Enable Animations</h4>
                <p className="text-sm text-secondary-600">Show smooth transitions and effects</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.animations}
                  onChange={(e) => updatePreference('animations', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Localization */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <Globe className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-secondary-900">Localization</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Language
                </label>
                <select
                  value={preferences.language}
                  onChange={(e) => updatePreference('language', e.target.value)}
                  className="input w-full"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="it">Italiano</option>
                  <option value="pt">Português</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Timezone
                </label>
                <select
                  value={preferences.timezone}
                  onChange={(e) => updatePreference('timezone', e.target.value)}
                  className="input w-full"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Performance */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-secondary-900">Performance</h3>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-secondary-900">Auto-save</h4>
                  <p className="text-sm text-secondary-600">Automatically save changes as you work</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.autoSave}
                    onChange={(e) => updatePreference('autoSave', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Auto-refresh Interval
                </label>
                <select
                  value={preferences.autoRefresh}
                  onChange={(e) => updatePreference('autoRefresh', parseInt(e.target.value))}
                  className="input w-full md:w-auto"
                >
                  <option value={0}>Disabled</option>
                  <option value={15}>15 seconds</option>
                  <option value={30}>30 seconds</option>
                  <option value={60}>1 minute</option>
                  <option value={300}>5 minutes</option>
                </select>
                <p className="text-xs text-secondary-500 mt-1">
                  How often to refresh data automatically
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Results per Page
                </label>
                <select
                  value={preferences.resultsPerPage}
                  onChange={(e) => updatePreference('resultsPerPage', parseInt(e.target.value))}
                  className="input w-full md:w-auto"
                >
                  <option value={5}>5 results</option>
                  <option value={10}>10 results</option>
                  <option value={25}>25 results</option>
                  <option value={50}>50 results</option>
                  <option value={100}>100 results</option>
                </select>
              </div>
            </div>
          </div>

          {/* Interface */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <Monitor className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-secondary-900">Interface</h3>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Default View
                </label>
                <select
                  value={preferences.defaultView}
                  onChange={(e) => updatePreference('defaultView', e.target.value)}
                  className="input w-full md:w-auto"
                >
                  <option value="dashboard">Dashboard</option>
                  <option value="documents">Documents</option>
                  <option value="chat">Chat</option>
                  <option value="search">Search</option>
                </select>
                <p className="text-xs text-secondary-500 mt-1">
                  Page to show when you log in
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-secondary-900">Keyboard Shortcuts</h4>
                  <p className="text-sm text-secondary-600">Enable keyboard navigation shortcuts</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.enableKeyboardShortcuts}
                    onChange={(e) => updatePreference('enableKeyboardShortcuts', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts Reference */}
          {preferences.enableKeyboardShortcuts && (
            <div className="card p-6 bg-secondary-50">
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">Keyboard Shortcuts</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Search</span>
                    <kbd className="px-2 py-1 bg-white rounded border text-xs">Ctrl + K</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>New Chat</span>
                    <kbd className="px-2 py-1 bg-white rounded border text-xs">Ctrl + N</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Upload Document</span>
                    <kbd className="px-2 py-1 bg-white rounded border text-xs">Ctrl + U</kbd>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Settings</span>
                    <kbd className="px-2 py-1 bg-white rounded border text-xs">Ctrl + ,</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Dashboard</span>
                    <kbd className="px-2 py-1 bg-white rounded border text-xs">Ctrl + D</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Help</span>
                    <kbd className="px-2 py-1 bg-white rounded border text-xs">Ctrl + ?</kbd>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save Indicator */}
          {isDirty && (
            <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-warning-800">
                <Save className="h-4 w-4" />
                <span className="font-medium">You have unsaved changes</span>
              </div>
              <p className="text-sm text-warning-700 mt-1">
                Don't forget to save your preferences before leaving this page.
              </p>
            </div>
          )}
        </div>
      </DashboardLayout>
    </AuthWrapper>
  );
}