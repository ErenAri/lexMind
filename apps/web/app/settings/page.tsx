'use client';

import { useState, useEffect } from 'react';
import AuthWrapper from '@/components/AuthWrapper';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/lib/auth';
import { 
  Settings,
  User,
  Shield,
  Bell,
  Database,
  Bot,
  Save,
  AlertCircle,
  CheckCircle,
  Key,
  Trash2,
  Download,
  Upload
} from 'lucide-react';

interface SystemHealth {
  api: boolean;
  db: boolean;
  llm: boolean;
  embed: boolean;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    findings: true,
    reports: true
  });
  const [profile, setProfile] = useState({
    username: user?.username || '',
    email: user?.email || '',
    role: user?.role || ''
  });
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    loadSystemHealth();
  }, []);

  const loadSystemHealth = async () => {
    try {
      const response = await fetch('/api/v1/health/full', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSystemHealth(data);
      }
    } catch (error) {
      console.error('Failed to load system health:', error);
    }
  };

  const saveProfile = async () => {
    setIsLoading(true);
    setSaveStatus('saving');
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async () => {
    if (passwordData.new !== passwordData.confirm) {
      alert('New passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/auth/password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          current_password: passwordData.current,
          new_password: passwordData.new
        }),
      });

      if (response.ok) {
        alert('Password changed successfully');
        setPasswordData({ current: '', new: '', confirm: '' });
      } else {
        throw new Error('Failed to change password');
      }
    } catch (error) {
      alert('Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const exportData = async () => {
    try {
      // Simulate data export
      const exportData = {
        user: profile,
        settings: notifications,
        timestamp: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lexmind-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to export settings');
    }
  };

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'system', name: 'System', icon: Database },
  ];

  return (
    <AuthWrapper>
      <DashboardLayout
        title="Settings"
        subtitle="Manage your account and system preferences"
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={exportData}
              className="btn btn-outline flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export Settings
            </button>
            {saveStatus === 'success' && (
              <div className="flex items-center gap-2 text-success-600">
                <CheckCircle className="h-4 w-4" />
                Settings saved
              </div>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="card p-4">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        activeTab === tab.id
                          ? 'bg-primary-100 text-primary-700'
                          : 'text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.name}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <User className="h-5 w-5 text-primary-600" />
                  <h3 className="text-lg font-semibold text-secondary-900">Profile Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={profile.username}
                      onChange={(e) => setProfile(prev => ({ ...prev, username: e.target.value }))}
                      className="input w-full"
                      placeholder="Enter username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                      className="input w-full"
                      placeholder="Enter email address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Role
                    </label>
                    <select
                      value={profile.role}
                      onChange={(e) => setProfile(prev => ({ ...prev, role: e.target.value }))}
                      className="input w-full"
                      disabled={user?.role !== 'admin'}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="analyst">Analyst</option>
                      <option value="admin">Administrator</option>
                    </select>
                    {user?.role !== 'admin' && (
                      <p className="text-xs text-secondary-500 mt-1">
                        Contact an administrator to change your role
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={saveProfile}
                    disabled={isLoading}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Bell className="h-5 w-5 text-primary-600" />
                  <h3 className="text-lg font-semibold text-secondary-900">Notification Preferences</h3>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-secondary-900">Email Notifications</h4>
                      <p className="text-sm text-secondary-600">Receive notifications via email</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications.email}
                        onChange={(e) => setNotifications(prev => ({ ...prev, email: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-secondary-900">Push Notifications</h4>
                      <p className="text-sm text-secondary-600">Receive browser push notifications</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications.push}
                        onChange={(e) => setNotifications(prev => ({ ...prev, push: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-secondary-900">Compliance Findings</h4>
                      <p className="text-sm text-secondary-600">Notify when new compliance issues are found</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications.findings}
                        onChange={(e) => setNotifications(prev => ({ ...prev, findings: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-secondary-900">Weekly Reports</h4>
                      <p className="text-sm text-secondary-600">Receive weekly compliance summary reports</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications.reports}
                        onChange={(e) => setNotifications(prev => ({ ...prev, reports: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={saveProfile}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save Preferences
                  </button>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="card p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Key className="h-5 w-5 text-primary-600" />
                    <h3 className="text-lg font-semibold text-secondary-900">Change Password</h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Current Password
                      </label>
                      <input
                        type="password"
                        value={passwordData.current}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, current: e.target.value }))}
                        className="input w-full"
                        placeholder="Enter current password"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={passwordData.new}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, new: e.target.value }))}
                        className="input w-full"
                        placeholder="Enter new password"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={passwordData.confirm}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirm: e.target.value }))}
                        className="input w-full"
                        placeholder="Confirm new password"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={changePassword}
                      disabled={!passwordData.current || !passwordData.new || !passwordData.confirm}
                      className="btn btn-primary flex items-center gap-2"
                    >
                      <Key className="h-4 w-4" />
                      Change Password
                    </button>
                  </div>
                </div>

                <div className="card p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Shield className="h-5 w-5 text-danger-600" />
                    <h3 className="text-lg font-semibold text-secondary-900">Danger Zone</h3>
                  </div>

                  <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-danger-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-danger-900">Delete Account</h4>
                        <p className="text-sm text-danger-700 mt-1">
                          Permanently delete your account and all associated data. This action cannot be undone.
                        </p>
                        <button className="btn btn-danger btn-sm mt-3 flex items-center gap-2">
                          <Trash2 className="h-4 w-4" />
                          Delete Account
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* System Tab */}
            {activeTab === 'system' && (
              <div className="space-y-6">
                <div className="card p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Database className="h-5 w-5 text-primary-600" />
                    <h3 className="text-lg font-semibold text-secondary-900">System Health</h3>
                  </div>

                  {systemHealth && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Database className="h-5 w-5 text-secondary-600" />
                          <span className="font-medium">API Server</span>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${systemHealth.api ? 'bg-success-500' : 'bg-danger-500'}`}></div>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Database className="h-5 w-5 text-secondary-600" />
                          <span className="font-medium">Database</span>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${systemHealth.db ? 'bg-success-500' : 'bg-danger-500'}`}></div>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Bot className="h-5 w-5 text-secondary-600" />
                          <span className="font-medium">AI Service (Ollama)</span>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${systemHealth.llm ? 'bg-success-500' : 'bg-danger-500'}`}></div>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Bot className="h-5 w-5 text-secondary-600" />
                          <span className="font-medium">Embeddings</span>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${systemHealth.embed ? 'bg-success-500' : 'bg-danger-500'}`}></div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={loadSystemHealth}
                      className="btn btn-outline flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Refresh Status
                    </button>
                  </div>
                </div>

                <div className="card p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Upload className="h-5 w-5 text-primary-600" />
                    <h3 className="text-lg font-semibold text-secondary-900">Data Management</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button className="btn btn-outline flex items-center gap-2 justify-center">
                      <Download className="h-4 w-4" />
                      Export All Data
                    </button>
                    <button className="btn btn-outline flex items-center gap-2 justify-center">
                      <Upload className="h-4 w-4" />
                      Import Data
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </AuthWrapper>
  );
}