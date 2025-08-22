'use client';

import AuthWrapper from '@/components/AuthWrapper';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/lib/auth';
import { 
  User,
  Mail,
  Shield,
  Calendar,
  Activity,
  Edit,
  Camera,
  Save,
  X
} from 'lucide-react';
import { useState } from 'react';

export default function ProfilePage() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    firstName: '',
    lastName: '',
    bio: '',
    location: '',
    phone: ''
  });

  const handleSave = async () => {
    // Simulate save
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      username: user?.username || '',
      email: user?.email || '',
      firstName: '',
      lastName: '',
      bio: '',
      location: '',
      phone: ''
    });
    setIsEditing(false);
  };

  return (
    <AuthWrapper>
      <DashboardLayout
        title="Profile"
        subtitle="Manage your personal information and preferences"
        actions={
          <div className="flex items-center gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="btn btn-outline flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save Changes
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Profile
              </button>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="card p-6 text-center">
              <div className="relative inline-block mb-4">
                <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                {isEditing && (
                  <button className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center border border-secondary-200 hover:bg-secondary-50">
                    <Camera className="h-4 w-4 text-secondary-600" />
                  </button>
                )}
              </div>
              
              <h2 className="text-xl font-semibold text-secondary-900 mb-1">
                {user?.username}
              </h2>
              <p className="text-secondary-600 mb-4 capitalize">
                {user?.role} • LexMind
              </p>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-center gap-2 text-secondary-600">
                  <Mail className="h-4 w-4" />
                  {user?.email || 'No email set'}
                </div>
                <div className="flex items-center justify-center gap-2 text-secondary-600">
                  <Calendar className="h-4 w-4" />
                  Joined Dec 2024
                </div>
                <div className="flex items-center justify-center gap-2 text-secondary-600">
                  <Activity className="h-4 w-4" />
                  Active now
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-secondary-200">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-secondary-900">12</div>
                    <div className="text-xs text-secondary-600">Documents</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-secondary-900">8</div>
                    <div className="text-xs text-secondary-600">Conversations</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Role Badge */}
            <div className="card p-4 mt-6">
              <div className="flex items-center gap-3 mb-3">
                <Shield className="h-5 w-5 text-primary-600" />
                <h3 className="font-semibold text-secondary-900">Access Level</h3>
              </div>
              <div className="space-y-2">
                <div className={`badge ${
                  user?.role === 'admin' ? 'badge-danger' :
                  user?.role === 'analyst' ? 'badge-warning' : 'badge-secondary'
                } w-full justify-center py-2`}>
                  {user?.role?.toUpperCase()}
                </div>
                <div className="text-xs text-secondary-600">
                  {user?.role === 'admin' && 'Full system access and user management'}
                  {user?.role === 'analyst' && 'Can upload documents and create findings'}
                  {user?.role === 'viewer' && 'Can view and search documents'}
                </div>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-secondary-900 mb-6">Personal Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    className="input w-full"
                    disabled={!isEditing}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="input w-full"
                    disabled={!isEditing}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    className="input w-full"
                    disabled={!isEditing}
                    placeholder="Enter first name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    className="input w-full"
                    disabled={!isEditing}
                    placeholder="Enter last name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="input w-full"
                    disabled={!isEditing}
                    placeholder="Enter phone number"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    className="input w-full"
                    disabled={!isEditing}
                    placeholder="Enter location"
                  />
                </div>
              </div>
              
              <div className="mt-6">
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Bio
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  className="input w-full h-24 resize-none"
                  disabled={!isEditing}
                  placeholder="Tell us about yourself..."
                />
              </div>
            </div>

            {/* Activity Summary */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-secondary-900 mb-6">Recent Activity</h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 bg-secondary-50 rounded-lg">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-secondary-900">
                      Updated profile information
                    </p>
                    <p className="text-xs text-secondary-600">2 hours ago</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-3 bg-secondary-50 rounded-lg">
                  <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center">
                    <Activity className="h-4 w-4 text-success-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-secondary-900">
                      Started new chat conversation
                    </p>
                    <p className="text-xs text-secondary-600">1 day ago</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-3 bg-secondary-50 rounded-lg">
                  <div className="w-8 h-8 bg-warning-100 rounded-full flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-warning-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-secondary-900">
                      Uploaded compliance document
                    </p>
                    <p className="text-xs text-secondary-600">3 days ago</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Preferences */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-secondary-900 mb-6">Quick Preferences</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-secondary-900">Email Notifications</h4>
                    <p className="text-sm text-secondary-600">Receive email updates</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-secondary-900">Dark Mode</h4>
                    <p className="text-sm text-secondary-600">Use dark theme</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-secondary-900">Auto-save Chat</h4>
                    <p className="text-sm text-secondary-600">Automatically save conversations</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </AuthWrapper>
  );
}